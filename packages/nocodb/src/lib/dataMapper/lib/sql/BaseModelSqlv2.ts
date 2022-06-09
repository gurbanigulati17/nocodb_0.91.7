import autoBind from 'auto-bind';
import _ from 'lodash';

import Model from '../../../noco-models/Model';
import { XKnex } from '../..';
import LinkToAnotherRecordColumn from '../../../noco-models/LinkToAnotherRecordColumn';
import RollupColumn from '../../../noco-models/RollupColumn';
import LookupColumn from '../../../noco-models/LookupColumn';
import DataLoader from 'dataloader';
import Column from '../../../noco-models/Column';
import { XcFilter, XcFilterWithAlias } from '../BaseModel';
import conditionV2 from './conditionV2';
import Filter from '../../../noco-models/Filter';
import sortV2 from './sortV2';
import Sort from '../../../noco-models/Sort';
import FormulaColumn from '../../../noco-models/FormulaColumn';
import genRollupSelectv2 from './genRollupSelectv2';
import formulaQueryBuilderv2 from './formulav2/formulaQueryBuilderv2';
import { QueryBuilder } from 'knex';
import View from '../../../noco-models/View';
import {
  AuditOperationSubTypes,
  AuditOperationTypes,
  RelationTypes,
  SortType,
  UITypes,
  ViewTypes
} from 'nocodb-sdk';
import formSubmissionEmailTemplate from '../../../noco/common/formSubmissionEmailTemplate';
import ejs from 'ejs';
import Audit from '../../../noco-models/Audit';
import FormView from '../../../noco-models/FormView';
import Hook from '../../../noco-models/Hook';
import NcPluginMgrv2 from '../../../noco/meta/helpers/NcPluginMgrv2';
import {
  _transformSubmittedFormDataForEmail,
  invokeWebhook,
  parseBody
} from '../../../noco/meta/helpers/webhookHelpers';
import Validator from 'validator';
import { customValidators } from './customValidators';
import { NcError } from '../../../noco/meta/helpers/catchError';
import { customAlphabet } from 'nanoid';

const GROUP_COL = '__nc_group_id';

const nanoidv2 = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 14);
const { v4: uuidv4 } = require('uuid');

async function populatePk(model: Model, insertObj: any) {
  await model.getColumns();
  for (const pkCol of model.primaryKeys) {
    if (!pkCol.meta?.ag || insertObj[pkCol.title]) continue;
    insertObj[pkCol.title] =
      pkCol.meta?.ag === 'nc' ? `rc_${nanoidv2()}` : uuidv4();
  }
}

/**
 * Base class for models
 *
 * @class
 * @classdesc Base class for models
 */
class BaseModelSqlv2 {
  protected dbDriver: XKnex;
  protected model: Model;
  protected viewId: string;
  private _proto: any;
  private _columns = {};

  private config: any = {
    limitDefault: 25,
    limitMin: 1,
    limitMax: 1000
  };

  constructor({
    dbDriver,
    model,
    viewId
  }: {
    [key: string]: any;
    model: Model;
  }) {
    this.dbDriver = dbDriver;
    this.model = model;
    this.viewId = viewId;
    autoBind(this);
  }

  public async readByPk(id?: any): Promise<any> {
    const qb = this.dbDriver(this.model.table_name);

    await this.selectObject({ qb });

    qb.where(this.model.primaryKey.column_name, id);

    const data = (await this.extractRawQueryAndExec(qb))?.[0];

    if (data) {
      const proto = await this.getProto();
      data.__proto__ = proto;
    }
    return data;
  }

  public async exist(id?: any): Promise<any> {
    const qb = this.dbDriver(this.model.table_name);
    await this.selectObject({ qb });
    const pks = this.model.primaryKeys;
    if ((id + '').split('___').length != pks.length) {
      return false;
    }
    return !!(await qb.where(_wherePk(pks, id)).first());
  }

  public async findOne(
    args: {
      where?: string;
      filterArr?: Filter[];
    } = {}
  ): Promise<any> {
    const qb = this.dbDriver(this.model.table_name);
    await this.selectObject({ qb });

    const aliasColObjMap = await this.model.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(args?.where, aliasColObjMap);

    await conditionV2(
      [
        new Filter({
          children: args.filterArr || [],
          is_group: true,
          logical_op: 'and'
        }),
        new Filter({
          children: filterObj,
          is_group: true,
          logical_op: 'and'
        }),
        ...(args.filterArr || [])
      ],
      qb,
      this.dbDriver
    );

    const data = await qb.first();

    if (data) {
      const proto = await this.getProto();
      data.__proto__ = proto;
    }
    return data;
  }

  public async list(
    args: {
      where?: string;
      limit?;
      offset?;
      filterArr?: Filter[];
      sortArr?: Sort[];
      sort?: string | string[];
    } = {},
    ignoreFilterSort = false
  ): Promise<any> {
    const { where, ...rest } = this._getListArgs(args as any);

    const qb = this.dbDriver(this.model.table_name);
    await this.selectObject({ qb });

    const aliasColObjMap = await this.model.getAliasColObjMap();

    let sorts = extractSortsObject(args?.sort, aliasColObjMap);

    const filterObj = extractFilterFromXwhere(args?.where, aliasColObjMap);

    // todo: replace with view id
    if (!ignoreFilterSort && this.viewId) {
      await conditionV2(
        [
          new Filter({
            children:
              (await Filter.rootFilterList({ viewId: this.viewId })) || [],
            is_group: true
          }),
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and'
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and'
          }),
          ...(args.filterArr || [])
        ],
        qb,
        this.dbDriver
      );

      if (!sorts)
        sorts = args.sortArr?.length
          ? args.sortArr
          : await Sort.list({ viewId: this.viewId });

      await sortV2(sorts, qb, this.dbDriver);
    } else {
      await conditionV2(
        [
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and'
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and'
          }),
          ...(args.filterArr || [])
        ],
        qb,
        this.dbDriver
      );

      if (!sorts) sorts = args.sortArr;

      await sortV2(sorts, qb, this.dbDriver);
    }

    // sort by primary key if not autogenerated string
    // if autogenerated string sort by created_at column if present
    if (this.model.primaryKey && this.model.primaryKey.ai) {
      qb.orderBy(this.model.primaryKey.column_name);
    } else if (this.model.columns.find(c => c.column_name === 'created_at')) {
      qb.orderBy('created_at');
    }

    if (!ignoreFilterSort) applyPaginate(qb, rest);
    const proto = await this.getProto();

    const data = await this.extractRawQueryAndExec(qb);

    return data?.map(d => {
      d.__proto__ = proto;
      return d;
    });
  }

  public async count(
    args: { where?: string; limit?; filterArr?: Filter[] } = {},
    ignoreFilterSort = false
  ): Promise<any> {
    await this.model.getColumns();
    const { where } = this._getListArgs(args);

    const qb = this.dbDriver(this.model.table_name);

    // qb.xwhere(where, await this.model.getAliasColMapping());
    const aliasColObjMap = await this.model.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

    if (!ignoreFilterSort && this.viewId) {
      await conditionV2(
        [
          new Filter({
            children:
              (await Filter.rootFilterList({ viewId: this.viewId })) || [],
            is_group: true
          }),
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and'
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and'
          }),
          ...(args.filterArr || [])
        ],
        qb,
        this.dbDriver
      );
    } else {
      await conditionV2(
        [
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and'
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and'
          }),
          ...(args.filterArr || [])
        ],
        qb,
        this.dbDriver
      );
    }

    qb.count(this.model.primaryKey?.column_name || '*', {
      as: 'count'
    }).first();

    return ((await qb) as any).count;
  }

  async groupBy(
    args: {
      where?: string;
      column_name: string;
      limit?;
      offset?;
      sort?: string | string[];
    } = {
      column_name: ''
    }
  ) {
    const { where, ...rest } = this._getListArgs(args as any);

    const qb = this.dbDriver(this.model.table_name);
    qb.count(`${this.model.primaryKey?.column_name || '*'} as count`);
    qb.select(args.column_name);

    const aliasColObjMap = await this.model.getAliasColObjMap();

    const sorts = extractSortsObject(args?.sort, aliasColObjMap);

    const filterObj = extractFilterFromXwhere(args?.where, aliasColObjMap);
    await conditionV2(
      [
        new Filter({
          children: filterObj,
          is_group: true,
          logical_op: 'and'
        })
      ],
      qb,
      this.dbDriver
    );
    qb.groupBy(args.column_name);
    if (sorts) await sortV2(sorts, qb, this.dbDriver);
    applyPaginate(qb, rest);

    return await qb;
  }

  async multipleHmList({ colId, ids }, args?: { limit?; offset? }) {
    try {
      // todo: get only required fields

      // const { cn } = this.hasManyRelations.find(({ tn }) => tn === child) || {};
      const relColumn = (await this.model.getColumns()).find(
        c => c.id === colId
      );

      const chilCol = await ((await relColumn.getColOptions()) as LinkToAnotherRecordColumn).getChildColumn();
      const childTable = await chilCol.getModel();
      const parentCol = await ((await relColumn.getColOptions()) as LinkToAnotherRecordColumn).getParentColumn();
      const parentTable = await parentCol.getModel();
      const childModel = await Model.getBaseModelSQL({
        model: childTable,
        dbDriver: this.dbDriver
      });
      await parentTable.getColumns();

      const qb = this.dbDriver(childTable.table_name);
      await childModel.selectObject({ qb });

      const childQb = this.dbDriver.queryBuilder().from(
        this.dbDriver
          .unionAll(
            ids.map(p => {
              const query = qb
                .clone()
                .select(this.dbDriver.raw('? as ??', [p, GROUP_COL]))
                .whereIn(
                  chilCol.column_name,
                  this.dbDriver(parentTable.table_name)
                    .select(parentCol.column_name)
                    // .where(parentTable.primaryKey.cn, p)
                    .where(_wherePk(parentTable.primaryKeys, p))
                );
              // todo: sanitize
              query.limit(args?.limit || 20);
              query.offset(args?.offset || 0);

              return this.isSqlite ? this.dbDriver.select().from(query) : query;
            }),
            !this.isSqlite
          )
          .as('list')
      );

      const children = await this.extractRawQueryAndExec(childQb);
      const proto = await (
        await Model.getBaseModelSQL({
          id: childTable.id,
          dbDriver: this.dbDriver
        })
      ).getProto();

      return _.groupBy(
        children.map(c => {
          c.__proto__ = proto;
          return c;
        }),
        GROUP_COL
      );
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async multipleHmListCount({ colId, ids }) {
    try {
      // const { cn } = this.hasManyRelations.find(({ tn }) => tn === child) || {};
      const relColumn = (await this.model.getColumns()).find(
        c => c.id === colId
      );
      const chilCol = await ((await relColumn.getColOptions()) as LinkToAnotherRecordColumn).getChildColumn();
      const childTable = await chilCol.getModel();
      const parentCol = await ((await relColumn.getColOptions()) as LinkToAnotherRecordColumn).getParentColumn();
      const parentTable = await parentCol.getModel();
      await parentTable.getColumns();

      const children = await this.dbDriver.unionAll(
        ids.map(p => {
          const query = this.dbDriver(childTable.table_name)
            .count(`${chilCol?.column_name} as count`)
            .whereIn(
              chilCol.column_name,
              this.dbDriver(parentTable.table_name)
                .select(parentCol.column_name)
                // .where(parentTable.primaryKey.cn, p)
                .where(_wherePk(parentTable.primaryKeys, p))
            )
            .first();

          return this.isSqlite ? this.dbDriver.select().from(query) : query;
        }),
        !this.isSqlite
      );

      return children.map(({ count }) => count);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async hmList({ colId, id }, args?: { limit?; offset? }) {
    try {
      // todo: get only required fields

      const relColumn = (await this.model.getColumns()).find(
        c => c.id === colId
      );

      const chilCol = await ((await relColumn.getColOptions()) as LinkToAnotherRecordColumn).getChildColumn();
      const childTable = await chilCol.getModel();
      const parentCol = await ((await relColumn.getColOptions()) as LinkToAnotherRecordColumn).getParentColumn();
      const parentTable = await parentCol.getModel();
      const childModel = await Model.getBaseModelSQL({
        model: childTable,
        dbDriver: this.dbDriver
      });
      await parentTable.getColumns();

      const qb = this.dbDriver(childTable.table_name);

      qb.whereIn(
        chilCol.column_name,
        this.dbDriver(parentTable.table_name)
          .select(parentCol.column_name)
          // .where(parentTable.primaryKey.cn, p)
          .where(_wherePk(parentTable.primaryKeys, id))
      );
      // todo: sanitize
      qb.limit(args?.limit || 20);
      qb.offset(args?.offset || 0);

      await childModel.selectObject({ qb });

      const children = await this.extractRawQueryAndExec(qb);

      const proto = await (
        await Model.getBaseModelSQL({
          id: childTable.id,
          dbDriver: this.dbDriver
        })
      ).getProto();

      return children.map(c => {
        c.__proto__ = proto;
        return c;
      });
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  async hmListCount({ colId, id }) {
    try {
      // const { cn } = this.hasManyRelations.find(({ tn }) => tn === child) || {};
      const relColumn = (await this.model.getColumns()).find(
        c => c.id === colId
      );
      const chilCol = await ((await relColumn.getColOptions()) as LinkToAnotherRecordColumn).getChildColumn();
      const childTable = await chilCol.getModel();
      const parentCol = await ((await relColumn.getColOptions()) as LinkToAnotherRecordColumn).getParentColumn();
      const parentTable = await parentCol.getModel();
      await parentTable.getColumns();

      const query = this.dbDriver(childTable.table_name)
        .count(`${chilCol?.column_name} as count`)
        .whereIn(
          chilCol.column_name,
          this.dbDriver(parentTable.table_name)
            .select(parentCol.column_name)
            .where(_wherePk(parentTable.primaryKeys, id))
        )
        .first();
      const { count } = await query;
      return count;
      // return _.groupBy(children, cn);
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  public async multipleMmList({ colId, parentIds }, args?: { limit; offset }) {
    const relColumn = (await this.model.getColumns()).find(c => c.id === colId);
    const relColOptions = (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    // const tn = this.model.tn;
    // const cn = (await relColOptions.getChildColumn()).title;
    const vtn = (await relColOptions.getMMModel()).table_name;
    const vcn = (await relColOptions.getMMChildColumn()).column_name;
    const vrcn = (await relColOptions.getMMParentColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getParentColumn()).getModel();
    const parentTable = await (await relColOptions.getChildColumn()).getModel();
    await parentTable.getColumns();
    const childModel = await Model.getBaseModelSQL({
      dbDriver: this.dbDriver,
      model: childTable
    });
    const rtn = childTable.table_name;
    const rtnId = childTable.id;

    const qb = this.dbDriver(rtn).join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`);

    await childModel.selectObject({ qb });
    const finalQb = this.dbDriver.unionAll(
      parentIds.map(id => {
        const query = qb
          .clone()
          .whereIn(
            `${vtn}.${vcn}`,
            this.dbDriver(parentTable.table_name)
              .select(cn)
              // .where(parentTable.primaryKey.cn, id)
              .where(_wherePk(parentTable.primaryKeys, id))
          )
          .select(this.dbDriver.raw('? as ??', [id, GROUP_COL]));

        // todo: sanitize
        query.limit(args?.limit || 20);
        query.offset(args?.offset || 0);

        return this.isSqlite ? this.dbDriver.select().from(query) : query;
      }),
      !this.isSqlite
    );

    const children = await this.extractRawQueryAndExec(finalQb);
    const proto = await (
      await Model.getBaseModelSQL({
        id: rtnId,
        dbDriver: this.dbDriver
      })
    ).getProto();
    const gs = _.groupBy(
      children.map(c => {
        c.__proto__ = proto;
        return c;
      }),
      GROUP_COL
    );
    return parentIds.map(id => gs[id] || []);
  }

  public async mmList({ colId, parentId }, args?: { limit; offset }) {
    const relColumn = (await this.model.getColumns()).find(c => c.id === colId);
    const relColOptions = (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    // const tn = this.model.tn;
    // const cn = (await relColOptions.getChildColumn()).title;
    const vtn = (await relColOptions.getMMModel()).table_name;
    const vcn = (await relColOptions.getMMChildColumn()).column_name;
    const vrcn = (await relColOptions.getMMParentColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getParentColumn()).getModel();
    const parentTable = await (await relColOptions.getChildColumn()).getModel();
    await parentTable.getColumns();
    const childModel = await Model.getBaseModelSQL({
      dbDriver: this.dbDriver,
      model: childTable
    });
    const rtn = childTable.table_name;
    const rtnId = childTable.id;

    const qb = this.dbDriver(rtn)
      .join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`)
      .whereIn(
        `${vtn}.${vcn}`,
        this.dbDriver(parentTable.table_name)
          .select(cn)
          // .where(parentTable.primaryKey.cn, id)
          .where(_wherePk(parentTable.primaryKeys, parentId))
      );

    await childModel.selectObject({ qb });
    // todo: sanitize
    qb.limit(args?.limit || 20);
    qb.offset(args?.offset || 0);

    const children = await this.extractRawQueryAndExec(qb);
    const proto = await (
      await Model.getBaseModelSQL({ id: rtnId, dbDriver: this.dbDriver })
    ).getProto();

    return children.map(c => {
      c.__proto__ = proto;
      return c;
    });
  }

  public async multipleMmListCount({ colId, parentIds }) {
    const relColumn = (await this.model.getColumns()).find(c => c.id === colId);
    const relColOptions = (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const vtn = (await relColOptions.getMMModel()).table_name;
    const vcn = (await relColOptions.getMMChildColumn()).column_name;
    const vrcn = (await relColOptions.getMMParentColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getParentColumn()).getModel();
    const rtn = childTable.table_name;
    const parentTable = await (await relColOptions.getChildColumn()).getModel();
    await parentTable.getColumns();

    const qb = this.dbDriver(rtn)
      .join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`)
      // .select({
      //   [`${tn}_${vcn}`]: `${vtn}.${vcn}`
      // })
      .count(`${vtn}.${vcn}`, { as: 'count' });

    // await childModel.selectObject({ qb });
    const children = await this.dbDriver.unionAll(
      parentIds.map(id => {
        const query = qb
          .clone()
          .whereIn(
            `${vtn}.${vcn}`,
            this.dbDriver(parentTable.table_name)
              .select(cn)
              // .where(parentTable.primaryKey.cn, id)
              .where(_wherePk(parentTable.primaryKeys, id))
          )
          .select(this.dbDriver.raw('? as ??', [id, GROUP_COL]));
        // this._paginateAndSort(query, { sort, limit, offset }, null, true);
        return this.isSqlite ? this.dbDriver.select().from(query) : query;
      }),
      !this.isSqlite
    );

    const gs = _.groupBy(children, GROUP_COL);
    return parentIds.map(id => gs?.[id]?.[0] || []);
  }

  public async mmListCount({ colId, parentId }) {
    const relColumn = (await this.model.getColumns()).find(c => c.id === colId);
    const relColOptions = (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const vtn = (await relColOptions.getMMModel()).table_name;
    const vcn = (await relColOptions.getMMChildColumn()).column_name;
    const vrcn = (await relColOptions.getMMParentColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getParentColumn()).getModel();
    const rtn = childTable.table_name;
    const parentTable = await (await relColOptions.getChildColumn()).getModel();
    await parentTable.getColumns();

    const qb = this.dbDriver(rtn)
      .join(vtn, `${vtn}.${vrcn}`, `${rtn}.${rcn}`)
      // .select({
      //   [`${tn}_${vcn}`]: `${vtn}.${vcn}`
      // })
      .count(`${vtn}.${vcn}`, { as: 'count' })
      .whereIn(
        `${vtn}.${vcn}`,
        this.dbDriver(parentTable.table_name)
          .select(cn)
          // .where(parentTable.primaryKey.cn, id)
          .where(_wherePk(parentTable.primaryKeys, parentId))
      )
      .first();

    const { count } = await qb;

    return count;
  }

  // todo: naming & optimizing
  public async getMmChildrenExcludedListCount(
    { colId, pid = null },
    args
  ): Promise<any> {
    const relColumn = (await this.model.getColumns()).find(c => c.id === colId);
    const relColOptions = (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const vtn = (await relColOptions.getMMModel()).table_name;
    const vcn = (await relColOptions.getMMChildColumn()).column_name;
    const vrcn = (await relColOptions.getMMParentColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getParentColumn()).getModel();
    const parentTable = await (await relColOptions.getChildColumn()).getModel();
    await parentTable.getColumns();
    const rtn = childTable.table_name;
    const qb = this.dbDriver(rtn)
      .count(`*`, { as: 'count' })
      .where(qb => {
        qb.whereNotIn(
          rcn,
          this.dbDriver(rtn)
            .select(`${rtn}.${rcn}`)
            .join(vtn, `${rtn}.${rcn}`, `${vtn}.${vrcn}`)
            .whereIn(
              `${vtn}.${vcn}`,
              this.dbDriver(parentTable.table_name)
                .select(cn)
                // .where(parentTable.primaryKey.cn, pid)
                .where(_wherePk(parentTable.primaryKeys, pid))
            )
        ).orWhereNull(rcn);
      });

    const aliasColObjMap = await childTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(args.where, aliasColObjMap);

    await conditionV2(filterObj, qb, this.dbDriver);
    return (await qb.first())?.count;
  }

  // todo: naming & optimizing
  public async getMmChildrenExcludedList(
    { colId, pid = null },
    args
  ): Promise<any> {
    const relColumn = (await this.model.getColumns()).find(c => c.id === colId);
    const relColOptions = (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const vtn = (await relColOptions.getMMModel()).table_name;
    const vcn = (await relColOptions.getMMChildColumn()).column_name;
    const vrcn = (await relColOptions.getMMParentColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getParentColumn()).getModel();
    const childModel = await Model.getBaseModelSQL({
      dbDriver: this.dbDriver,
      model: childTable
    });
    const parentTable = await (await relColOptions.getChildColumn()).getModel();
    await parentTable.getColumns();
    const rtn = childTable.table_name;

    const qb = this.dbDriver(rtn).where(qb =>
      qb
        .whereNotIn(
          rcn,
          this.dbDriver(rtn)
            .select(`${rtn}.${rcn}`)
            .join(vtn, `${rtn}.${rcn}`, `${vtn}.${vrcn}`)
            .whereIn(
              `${vtn}.${vcn}`,
              this.dbDriver(parentTable.table_name)
                .select(cn)
                // .where(parentTable.primaryKey.cn, pid)
                .where(_wherePk(parentTable.primaryKeys, pid))
            )
        )
        .orWhereNull(rcn)
    );

    await childModel.selectObject({ qb });

    const aliasColObjMap = await childTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(args.where, aliasColObjMap);
    await conditionV2(filterObj, qb, this.dbDriver);

    applyPaginate(qb, args);

    const proto = await childModel.getProto();

    return (await qb).map(c => {
      c.__proto__ = proto;
      return c;
    });
  }

  // todo: naming & optimizing
  public async getHmChildrenExcludedListCount(
    { colId, pid = null },
    args
  ): Promise<any> {
    const relColumn = (await this.model.getColumns()).find(c => c.id === colId);
    const relColOptions = (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const cn = (await relColOptions.getChildColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const childTable = await (await relColOptions.getChildColumn()).getModel();
    const parentTable = await (
      await relColOptions.getParentColumn()
    ).getModel();
    const tn = childTable.table_name;
    const rtn = parentTable.table_name;
    await parentTable.getColumns();

    const qb = this.dbDriver(tn)
      .count(`*`, { as: 'count' })
      .where(qb => {
        qb.whereNotIn(
          cn,
          this.dbDriver(rtn)
            .select(rcn)
            // .where(parentTable.primaryKey.cn, pid)
            .where(_wherePk(parentTable.primaryKeys, pid))
        ).orWhereNull(cn);
      });

    const aliasColObjMap = await childTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(args.where, aliasColObjMap);

    await conditionV2(filterObj, qb, this.dbDriver);

    return (await qb.first())?.count;
  }

  // todo: naming & optimizing
  public async getHmChildrenExcludedList(
    { colId, pid = null },
    args
  ): Promise<any> {
    const relColumn = (await this.model.getColumns()).find(c => c.id === colId);
    const relColOptions = (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const cn = (await relColOptions.getChildColumn()).column_name;
    const rcn = (await relColOptions.getParentColumn()).column_name;
    const childTable = await (await relColOptions.getChildColumn()).getModel();
    const parentTable = await (
      await relColOptions.getParentColumn()
    ).getModel();
    const childModel = await Model.getBaseModelSQL({
      dbDriver: this.dbDriver,
      model: childTable
    });
    await parentTable.getColumns();

    const tn = childTable.table_name;
    const rtn = parentTable.table_name;

    const qb = this.dbDriver(tn).where(qb => {
      qb.whereNotIn(
        cn,
        this.dbDriver(rtn)
          .select(rcn)
          // .where(parentTable.primaryKey.cn, pid)
          .where(_wherePk(parentTable.primaryKeys, pid))
      ).orWhereNull(cn);
    });

    await childModel.selectObject({ qb });

    const aliasColObjMap = await childTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(args.where, aliasColObjMap);
    await conditionV2(filterObj, qb, this.dbDriver);

    applyPaginate(qb, args);

    const proto = await childModel.getProto();

    return (await qb).map(c => {
      c.__proto__ = proto;
      return c;
    });
  }

  // todo: naming & optimizing
  public async getBtChildrenExcludedListCount(
    { colId, cid = null },
    args
  ): Promise<any> {
    const relColumn = (await this.model.getColumns()).find(c => c.id === colId);
    const relColOptions = (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const rcn = (await relColOptions.getParentColumn()).column_name;
    const parentTable = await (
      await relColOptions.getParentColumn()
    ).getModel();
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getChildColumn()).getModel();

    const rtn = parentTable.table_name;
    const tn = childTable.table_name;
    await childTable.getColumns();

    const qb = this.dbDriver(rtn)
      .where(qb => {
        qb.whereNotIn(
          rcn,
          this.dbDriver(tn)
            .select(cn)
            // .where(childTable.primaryKey.cn, cid)
            .where(_wherePk(childTable.primaryKeys, cid))
        ).orWhereNull(rcn);
      })
      .count(`*`, { as: 'count' });

    const aliasColObjMap = await parentTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(args.where, aliasColObjMap);

    await conditionV2(filterObj, qb, this.dbDriver);
    return (await qb.first())?.count;
  }

  // todo: naming & optimizing
  public async getBtChildrenExcludedList(
    { colId, cid = null },
    args
  ): Promise<any> {
    const relColumn = (await this.model.getColumns()).find(c => c.id === colId);
    const relColOptions = (await relColumn.getColOptions()) as LinkToAnotherRecordColumn;

    const rcn = (await relColOptions.getParentColumn()).column_name;
    const parentTable = await (
      await relColOptions.getParentColumn()
    ).getModel();
    const cn = (await relColOptions.getChildColumn()).column_name;
    const childTable = await (await relColOptions.getChildColumn()).getModel();
    const parentModel = await Model.getBaseModelSQL({
      dbDriver: this.dbDriver,
      model: parentTable
    });
    const rtn = parentTable.table_name;
    const tn = childTable.table_name;
    await childTable.getColumns();

    const qb = this.dbDriver(rtn).where(qb => {
      qb.whereNotIn(
        rcn,
        this.dbDriver(tn)
          .select(cn)
          // .where(childTable.primaryKey.cn, cid)
          .where(_wherePk(childTable.primaryKeys, cid))
          .whereNotNull(cn)
      ).orWhereNull(rcn);
    });

    await parentModel.selectObject({ qb });

    const aliasColObjMap = await parentTable.getAliasColObjMap();
    const filterObj = extractFilterFromXwhere(args.where, aliasColObjMap);
    await conditionV2(filterObj, qb, this.dbDriver);

    applyPaginate(qb, args);

    const proto = await parentModel.getProto();

    return (await qb).map(c => {
      c.__proto__ = proto;
      return c;
    });
  }

  async getProto() {
    if (this._proto) {
      return this._proto;
    }

    const proto: any = { __columnAliases: {} };
    const columns = await this.model.getColumns();
    for (const column of columns) {
      switch (column.uidt) {
        case UITypes.Rollup:
          {
            // @ts-ignore
            const colOptions: RollupColumn = await column.getColOptions();
          }
          break;
        case UITypes.Lookup:
          {
            // @ts-ignore
            const colOptions: LookupColumn = await column.getColOptions();
            proto.__columnAliases[column.title] = {
              path: [
                (await Column.get({ colId: colOptions.fk_relation_column_id }))
                  ?.title,
                (await Column.get({ colId: colOptions.fk_lookup_column_id }))
                  ?.title
              ]
            };
          }
          break;
        case UITypes.LinkToAnotherRecord:
          {
            this._columns[column.title] = column;
            const colOptions = (await column.getColOptions()) as LinkToAnotherRecordColumn;
            // const parentColumn = await colOptions.getParentColumn();

            if (colOptions?.type === 'hm') {
              const listLoader = new DataLoader(async (ids: string[]) => {
                try {
                  if (ids.length > 1) {
                    const data = await this.multipleHmList(
                      {
                        colId: column.id,
                        ids
                      },
                      (listLoader as any).args
                    );
                    return ids.map((id: string) => (data[id] ? data[id] : []));
                  } else {
                    return [
                      await this.hmList(
                        {
                          colId: column.id,
                          id: ids[0]
                        },
                        (listLoader as any).args
                      )
                    ];
                  }
                } catch (e) {
                  console.log(e);
                  return [];
                }
              });
              const self: BaseModelSqlv2 = this;

              proto[column.title] = async function(args): Promise<any> {
                (listLoader as any).args = args;
                return listLoader.load(
                  getCompositePk(self.model.primaryKeys, this)
                );
              };

              // defining HasMany count method within GQL Type class
              // Object.defineProperty(type.prototype, column.alias, {
              //   async value(): Promise<any> {
              //     return listLoader.load(this[model.pk.alias]);
              //   },
              //   configurable: true
              // });
            } else if (colOptions.type === 'mm') {
              const listLoader = new DataLoader(async (ids: string[]) => {
                try {
                  if (ids?.length > 1) {
                    const data = await this.multipleMmList(
                      {
                        parentIds: ids,
                        colId: column.id
                      },
                      (listLoader as any).args
                    );

                    return data;
                  } else {
                    return [
                      await this.mmList(
                        {
                          parentId: ids[0],
                          colId: column.id
                        },
                        (listLoader as any).args
                      )
                    ];
                  }
                } catch (e) {
                  console.log(e);
                  return [];
                }
              });

              const self: BaseModelSqlv2 = this;
              // const childColumn = await colOptions.getChildColumn();
              proto[column.title] = async function(args): Promise<any> {
                (listLoader as any).args = args;
                return await listLoader.load(
                  getCompositePk(self.model.primaryKeys, this)
                );
              };
            } else if (colOptions.type === 'bt') {
              // @ts-ignore
              const colOptions = (await column.getColOptions()) as LinkToAnotherRecordColumn;
              const pCol = await Column.get({
                colId: colOptions.fk_parent_column_id
              });
              const cCol = await Column.get({
                colId: colOptions.fk_child_column_id
              });
              const readLoader = new DataLoader(async (ids: string[]) => {
                try {
                  const data = await (
                    await Model.getBaseModelSQL({
                      id: pCol.fk_model_id,
                      dbDriver: this.dbDriver
                    })
                  ).list(
                    {
                      // limit: ids.length,
                      where: `(${pCol.column_name},in,${ids.join(',')})`
                    },
                    true
                  );
                  const gs = _.groupBy(data, pCol.title);
                  return ids.map(async (id: string) => gs?.[id]?.[0]);
                } catch (e) {
                  console.log(e);
                  return [];
                }
              });

              // defining HasMany count method within GQL Type class
              proto[column.title] = async function() {
                if (
                  this?.[cCol?.title] === null ||
                  this?.[cCol?.title] === undefined
                )
                  return null;

                return await readLoader.load(this?.[cCol?.title]);
              };
              // todo : handle mm
            }
          }
          break;
      }
    }
    this._proto = proto;
    return proto;
  }

  _getListArgs(args: XcFilterWithAlias): XcFilter {
    const obj: XcFilter = {};
    obj.where = args.where || args.w || '';
    obj.having = args.having || args.h || '';
    obj.condition = args.condition || args.c || {};
    obj.conditionGraph = args.conditionGraph || {};
    obj.limit = Math.max(
      Math.min(
        args.limit || args.l || this.config.limitDefault,
        this.config.limitMax
      ),
      this.config.limitMin
    );
    obj.offset = Math.max(+(args.offset || args.o) || 0, 0);
    obj.fields = args.fields || args.f || '*';
    obj.sort = args.sort || args.s || this.model.primaryKey?.[0]?.tn;
    return obj;
  }

  public async selectObject({ qb }: { qb: QueryBuilder }): Promise<void> {
    const res = {};
    const columns = await this.model.getColumns();
    for (const column of columns) {
      switch (column.uidt) {
        case 'LinkToAnotherRecord':
        case 'Lookup':
          break;
        case 'Formula':
          {
            const formula = await column.getColOptions<FormulaColumn>();
            if (formula.error) continue;
            const selectQb = await formulaQueryBuilderv2(
              formula.formula,
              null,
              this.dbDriver,
              this.model
              // this.aliasToColumn
            );
            // todo:  verify syntax of as ? / ??
            qb.select(
              this.dbDriver.raw(`?? as ??`, [
                selectQb.builder,
                sanitize(column.title)
              ])
            );
          }
          break;
        case 'Rollup':
          qb.select(
            (
              await genRollupSelectv2({
                // tn: this.title,
                knex: this.dbDriver,
                // column,
                columnOptions: (await column.getColOptions()) as RollupColumn
              })
            ).builder.as(sanitize(column.title))
          );
          break;
        default:
          res[sanitize(column.title || column.column_name)] = sanitize(
            `${this.model.table_name}.${column.column_name}`
          );
          break;
      }
    }
    qb.select(res);
  }

  async insert(data, trx?, cookie?) {
    try {
      await populatePk(this.model, data);

      // todo: filter based on view
      const insertObj = await this.model.mapAliasToColumn(data, sanitize);

      await this.validate(insertObj);

      if ('beforeInsert' in this) {
        await this.beforeInsert(insertObj, trx, cookie);
      }

      // if ('beforeInsert' in this) {
      //   await this.beforeInsert(insertObj, trx, cookie);
      // }
      await this.model.getColumns();
      let response;
      // const driver = trx ? trx : this.dbDriver;

      const query = this.dbDriver(this.tnPath).insert(insertObj);

      if (this.isPg || this.isMssql) {
        query.returning(
          `${this.model.primaryKey.column_name} as ${this.model.primaryKey.title}`
        );
        response = await query;
      }

      const ai = this.model.columns.find(c => c.ai);
      if (
        !response ||
        (typeof response?.[0] !== 'object' && response?.[0] !== null)
      ) {
        let id;
        if (response?.length) {
          id = response[0];
        } else {
          id = (await query)[0];
        }

        if (ai) {
          // response = await this.readByPk(id)
          response = await this.readByPk(id);
        } else {
          response = data;
        }
      } else if (ai) {
        response = await this.readByPk(
          Array.isArray(response)
            ? response?.[0]?.[ai.title]
            : response?.[ai.title]
        );
      }

      await this.afterInsert(response, trx, cookie);
      return Array.isArray(response) ? response[0] : response;
    } catch (e) {
      console.log(e);
      await this.errorInsert(e, data, trx, cookie);
      throw e;
    }
  }

  async delByPk(id, trx?, cookie?) {
    try {
      // retrieve data for handling paramas in hook
      const data = await this.readByPk(id);
      await this.beforeDelete(id, trx, cookie);
      const response = await this.dbDriver(this.tnPath)
        .del()
        .where(await this._wherePk(id));
      await this.afterDelete(data, trx, cookie);
      return response;
    } catch (e) {
      console.log(e);
      await this.errorDelete(e, id, trx, cookie);
      throw e;
    }
  }

  async updateByPk(id, data, trx?, cookie?) {
    try {
      const updateObj = await this.model.mapAliasToColumn(data);

      await this.validate(data);

      await this.beforeUpdate(data, trx, cookie);

      // const driver = trx ? trx : this.dbDriver;
      //
      // this.validate(data);
      // await this._run(
      await this.dbDriver(this.tnPath)
        .update(updateObj)
        .where(await this._wherePk(id));
      // );

      const response = await this.readByPk(id);
      await this.afterUpdate(response, trx, cookie);
      return response;
    } catch (e) {
      console.log(e);
      await this.errorUpdate(e, data, trx, cookie);
      throw e;
    }
  }

  async _wherePk(id) {
    await this.model.getColumns();
    return _wherePk(this.model.primaryKeys, id);
  }

  public get tnPath() {
    const schema = (this.dbDriver as any).searchPath?.();
    const table =
      this.isMssql && schema
        ? this.dbDriver.raw('??.??', [schema, this.model.table_name])
        : this.model.table_name;
    return table;
  }

  get isSqlite() {
    return this.clientType === 'sqlite3';
  }

  get isMssql() {
    return this.clientType === 'mssql';
  }

  get isPg() {
    return this.clientType === 'pg';
  }
  get isMySQL() {
    return this.clientType === 'mysql2' || this.clientType === 'mysql';
  }

  get clientType() {
    return this.dbDriver.clientType();
  }

  async nestedInsert(data, _trx = null, cookie?) {
    // const driver = trx ? trx : await this.dbDriver.transaction();
    try {
      await populatePk(this.model, data);
      const insertObj = await this.model.mapAliasToColumn(data);

      let rowId = null;
      const postInsertOps = [];

      const nestedCols = (await this.model.getColumns()).filter(
        c => c.uidt === UITypes.LinkToAnotherRecord
      );

      for (const col of nestedCols) {
        if (col.title in data) {
          const colOptions = await col.getColOptions<
            LinkToAnotherRecordColumn
          >();

          // parse data if it's JSON string
          const nestedData =
            typeof data[col.title] === 'string'
              ? JSON.parse(data[col.title])
              : data[col.title];

          switch (colOptions.type) {
            case RelationTypes.BELONGS_TO:
              {
                const parentCol = await colOptions.getParentColumn();
                insertObj[parentCol.column_name] =
                  nestedData?.[parentCol.title];
              }
              break;
            case RelationTypes.HAS_MANY:
              {
                const childCol = await colOptions.getChildColumn();
                const childModel = await childCol.getModel();
                await childModel.getColumns();

                postInsertOps.push(async () => {
                  await this.dbDriver(childModel.table_name)
                    .update({
                      [childCol.column_name]: rowId
                    })
                    .whereIn(
                      childModel.primaryKey.column_name,
                      nestedData?.map(r => r[childModel.primaryKey.title])
                    );
                });
              }
              break;
            case RelationTypes.MANY_TO_MANY: {
              postInsertOps.push(async () => {
                const parentModel = await colOptions
                  .getParentColumn()
                  .then(c => c.getModel());
                await parentModel.getColumns();
                const parentMMCol = await colOptions.getMMParentColumn();
                const childMMCol = await colOptions.getMMChildColumn();
                const mmModel = await colOptions.getMMModel();

                const rows = nestedData.map(r => ({
                  [parentMMCol.column_name]: r[parentModel.primaryKey.title],
                  [childMMCol.column_name]: rowId
                }));
                await this.dbDriver(mmModel.table_name).insert(rows);
              });
            }
          }
        }
      }

      await this.validate(insertObj);

      await this.beforeInsert(insertObj, this.dbDriver, cookie);

      let response;
      const query = this.dbDriver(this.tnPath).insert(insertObj);

      if (this.isPg || this.isMssql) {
        query.returning(
          `${this.model.primaryKey.column_name} as ${this.model.primaryKey.title}`
        );
        response = await query;
      }

      const ai = this.model.columns.find(c => c.ai);
      if (
        !response ||
        (typeof response?.[0] !== 'object' && response?.[0] !== null)
      ) {
        let id;
        if (response?.length) {
          id = response[0];
        } else {
          id = (await query)[0];
        }

        if (ai) {
          // response = await this.readByPk(id)
          response = await this.readByPk(id);
        } else {
          response = data;
        }
      } else if (ai) {
        response = await this.readByPk(
          Array.isArray(response)
            ? response?.[0]?.[ai.title]
            : response?.[ai.title]
        );
      }
      response = Array.isArray(response) ? response[0] : response;
      if (response)
        rowId =
          response[this.model.primaryKey.title] ||
          response[this.model.primaryKey.column_name];
      await Promise.all(postInsertOps.map(f => f()));

      // if (!trx) {
      //   await driver.commit();
      // }

      await this.afterInsert(response, this.dbDriver, cookie);

      return response;
    } catch (e) {
      console.log(e);
      // await this.errorInsert(e, data, trx, cookie);
      // if (!trx) {
      //   await driver.rollback(e);
      // }
      throw e;
    }
  }

  async bulkInsert(
    datas: any[],
    {
      chunkSize: _chunkSize = 100
    }: {
      chunkSize?: number;
    } = {}
  ) {
    try {
      const insertDatas = await Promise.all(
        datas.map(async d => {
          await populatePk(this.model, d);
          return this.model.mapAliasToColumn(d);
        })
      );

      // await this.beforeInsertb(insertDatas, null);

      for (const data of datas) {
        await this.validate(data);
      }
      // let chunkSize = 50;
      //
      // if (this.isSqlite && datas[0]) {
      //   chunkSize = Math.max(1, Math.floor(999 / Object.keys(datas[0]).length));
      // }

      // fallbacks to `10` if database client is sqlite
      // to avoid `too many SQL variables` error
      // refer : https://www.sqlite.org/limits.html
      const chunkSize = this.isSqlite ? 10 : _chunkSize;

      const response = await this.dbDriver
        .batchInsert(this.model.table_name, insertDatas, chunkSize)
        .returning(this.model.primaryKey?.column_name);

      // await this.afterInsertb(insertDatas, null);

      return response;
    } catch (e) {
      // await this.errorInsertb(e, data, null);
      throw e;
    }
  }

  async bulkUpdate(datas: any[]) {
    let transaction;
    try {
      const updateDatas = await Promise.all(
        datas.map(d => this.model.mapAliasToColumn(d))
      );

      transaction = await this.dbDriver.transaction();

      // await this.beforeUpdateb(updateDatas, transaction);
      const res = [];
      for (const d of updateDatas) {
        await this.validate(d);
        const pkValues = await this._extractPksValues(d);
        if (!pkValues) {
          // pk not specified - bypass
          continue;
        }
        const wherePk = await this._wherePk(pkValues);
        const response = await transaction(this.model.table_name)
          .update(d)
          .where(wherePk);
        res.push(response);
      }

      // await this.afterUpdateb(res, transaction);
      transaction.commit();

      return res;
    } catch (e) {
      if (transaction) transaction.rollback();
      // console.log(e);
      // await this.errorUpdateb(e, data, null);
      throw e;
    }
  }

  async bulkUpdateAll(
    args: { where?: string; filterArr?: Filter[] } = {},
    data
  ) {
    try {
      const updateData = await this.model.mapAliasToColumn(data);
      await this.validate(updateData);
      const pkValues = await this._extractPksValues(updateData);
      let res = null;
      if (pkValues) {
        // pk is specified - by pass
      } else {
        await this.model.getColumns();
        const { where } = this._getListArgs(args);
        const qb = this.dbDriver(this.model.table_name);
        const aliasColObjMap = await this.model.getAliasColObjMap();
        const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

        await conditionV2(
          [
            new Filter({
              children: args.filterArr || [],
              is_group: true,
              logical_op: 'and'
            }),
            new Filter({
              children: filterObj,
              is_group: true,
              logical_op: 'and'
            }),
            ...(args.filterArr || [])
          ],
          qb,
          this.dbDriver
        );
        qb.update(updateData);
        res = ((await qb) as any).count;
      }
      return res;
    } catch (e) {
      throw e;
    }
  }

  async bulkDelete(ids: any[]) {
    let transaction;
    try {
      transaction = await this.dbDriver.transaction();
      // await this.beforeDeleteb(ids, transaction);

      const res = [];
      for (const d of ids) {
        if (Object.keys(d).length) {
          const response = await transaction(this.model.table_name)
            .del()
            .where(d);
          res.push(response);
        }
      }
      // await this.afterDeleteb(res, transaction);

      transaction.commit();

      return res;
    } catch (e) {
      if (transaction) transaction.rollback();
      console.log(e);
      // await this.errorDeleteb(e, ids);
      throw e;
    }
  }

  async bulkDeleteAll(args: { where?: string; filterArr?: Filter[] } = {}) {
    try {
      await this.model.getColumns();
      const { where } = this._getListArgs(args);
      const qb = this.dbDriver(this.model.table_name);
      const aliasColObjMap = await this.model.getAliasColObjMap();
      const filterObj = extractFilterFromXwhere(where, aliasColObjMap);

      await conditionV2(
        [
          new Filter({
            children: args.filterArr || [],
            is_group: true,
            logical_op: 'and'
          }),
          new Filter({
            children: filterObj,
            is_group: true,
            logical_op: 'and'
          }),
          ...(args.filterArr || [])
        ],
        qb,
        this.dbDriver
      );
      qb.del();
      return ((await qb) as any).count;
    } catch (e) {
      throw e;
    }
  }

  /**
   *  Hooks
   * */

  public async beforeInsert(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('Before.insert', data, req);
  }

  public async afterInsert(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('After.insert', data, req);
    // if (req?.headers?.['xc-gui']) {
    const id = this._extractPksValues(data);
    Audit.insert({
      fk_model_id: this.model.id,
      row_id: id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.INSERT,
      description: `${id} inserted into ${this.model.title}`,
      // details: JSON.stringify(data),
      ip: req?.clientIp,
      user: req?.user?.email
    });
    // }
  }

  public async beforeUpdate(data: any, _trx: any, req): Promise<void> {
    const ignoreWebhook = req.query?.ignoreWebhook;
    if (ignoreWebhook) {
      if (ignoreWebhook != 'true' && ignoreWebhook != 'false') {
        throw new Error('ignoreWebhook value can be either true or false');
      }
    }
    if (ignoreWebhook === undefined || ignoreWebhook === 'false') {
      await this.handleHooks('Before.update', data, req);
    }
  }

  public async afterUpdate(data: any, _trx: any, req): Promise<void> {
    const ignoreWebhook = req.query?.ignoreWebhook;
    if (ignoreWebhook) {
      if (ignoreWebhook != 'true' && ignoreWebhook != 'false') {
        throw new Error('ignoreWebhook value can be either true or false');
      }
    }
    if (ignoreWebhook === undefined || ignoreWebhook === 'false') {
      await this.handleHooks('After.update', data, req);
    }
  }

  public async beforeDelete(data: any, _trx: any, req): Promise<void> {
    await this.handleHooks('Before.delete', data, req);
  }

  public async afterDelete(data: any, _trx: any, req): Promise<void> {
    // if (req?.headers?.['xc-gui']) {
    const id = req?.params?.id;
    Audit.insert({
      fk_model_id: this.model.id,
      row_id: id,
      op_type: AuditOperationTypes.DATA,
      op_sub_type: AuditOperationSubTypes.DELETE,
      description: `${id} deleted from ${this.model.title}`,
      // details: JSON.stringify(data),
      ip: req?.clientIp,
      user: req?.user?.email
    });
    // }
    await this.handleHooks('After.delete', data, req);
  }

  private async handleHooks(hookName, data, req): Promise<void> {
    // const data = _data;

    const view = await View.get(this.viewId);

    // handle form view data submission
    if (hookName === 'After.insert' && view.type === ViewTypes.FORM) {
      try {
        const formView = await view.getView<FormView>();
        const emails = Object.entries(JSON.parse(formView?.email) || {})
          .filter(a => a[1])
          .map(a => a[0]);
        if (emails?.length) {
          const transformedData = _transformSubmittedFormDataForEmail(
            data,
            formView,
            await this.model.getColumns()
          );
          // todo: notification template
          (await NcPluginMgrv2.emailAdapter())?.mailSend({
            to: emails.join(','),
            subject: parseBody('NocoDB Form', req, data, {}),
            html: ejs.render(formSubmissionEmailTemplate, {
              data: transformedData,
              tn: this.model.table_name,
              _tn: this.model.title
            })
          });
        }
      } catch (e) {
        console.log(e);
      }
    }

    try {
      const [event, operation] = hookName.split('.');
      const hooks = await Hook.list({
        fk_model_id: this.model.id,
        event,
        operation
      });
      for (const hook of hooks) {
        invokeWebhook(hook, this.model, data, req?.user);
      }
    } catch (e) {
      console.log('hooks :: error', hookName, e);
    }
  }

  // @ts-ignore
  protected async errorInsert(e, data, trx, cookie) {}

  // @ts-ignore
  protected async errorUpdate(e, data, trx, cookie) {}

  // todo: handle composite primary key
  protected _extractPksValues(data: any) {
    // data can be still inserted without PK
    // TODO: return a meaningful value
    if (!this.model.primaryKey) return 'N/A';
    return (
      data[this.model.primaryKey.title] ||
      data[this.model.primaryKey.column_name]
    );
  }

  // @ts-ignore
  protected async errorDelete(e, id, trx, cookie) {}

  async validate(columns) {
    await this.model.getColumns();
    // let cols = Object.keys(this.columns);
    for (let i = 0; i < this.model.columns.length; ++i) {
      const column = this.model.columns[i];
      // skip validation if `validate` is undefined or false
      if (!column?.meta?.validate) continue;

      const validate = column.getValidators();
      const cn = column.column_name;
      if (!validate) continue;
      const { func, msg } = validate;
      for (let j = 0; j < func.length; ++j) {
        const fn =
          typeof func[j] === 'string'
            ? customValidators[func[j]]
              ? customValidators[func[j]]
              : Validator[func[j]]
            : func[j];
        const arg =
          typeof func[j] === 'string' ? columns[cn] + '' : columns[cn];
        if (
          columns[cn] !== null &&
          columns[cn] !== undefined &&
          columns[cn] !== '' &&
          cn in columns &&
          !(fn.constructor.name === 'AsyncFunction' ? await fn(arg) : fn(arg))
        ) {
          NcError.badRequest(
            msg[j].replace(/\{VALUE}/g, columns[cn]).replace(/\{cn}/g, cn)
          );
        }
      }
    }
    return true;
  }

  async addChild({
    colId,
    rowId,
    childId
  }: {
    colId: string;
    rowId: string;
    childId: string;
  }) {
    const columns = await this.model.getColumns();
    const column = columns.find(c => c.id === colId);

    if (!column || column.uidt !== UITypes.LinkToAnotherRecord)
      NcError.notFound('Column not found');

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>();

    const childColumn = await colOptions.getChildColumn();
    const parentColumn = await colOptions.getParentColumn();
    const parentTable = await parentColumn.getModel();
    const childTable = await childColumn.getModel();
    await childTable.getColumns();
    await parentTable.getColumns();

    switch (colOptions.type) {
      case RelationTypes.MANY_TO_MANY:
        {
          const vChildCol = await colOptions.getMMChildColumn();
          const vParentCol = await colOptions.getMMParentColumn();
          const vTable = await colOptions.getMMModel();

          await this.dbDriver(vTable.table_name).insert({
            [vParentCol.column_name]: this.dbDriver(parentTable.table_name)
              .select(parentColumn.column_name)
              .where(_wherePk(parentTable.primaryKeys, childId))
              .first(),
            [vChildCol.column_name]: this.dbDriver(childTable.table_name)
              .select(childColumn.column_name)
              .where(_wherePk(childTable.primaryKeys, rowId))
              .first()
          });
        }
        break;
      case RelationTypes.HAS_MANY:
        {
          await this.dbDriver(childTable.table_name)
            .update({
              [childColumn.column_name]: this.dbDriver.from(
                this.dbDriver(parentTable.table_name)
                  .select(parentColumn.column_name)
                  .where(_wherePk(parentTable.primaryKeys, rowId))
                  .first()
                  .as('___cn_alias')
              )
            })
            .where(_wherePk(childTable.primaryKeys, childId));
        }
        break;
      case RelationTypes.BELONGS_TO:
        {
          await this.dbDriver(childTable.table_name)
            .update({
              [childColumn.column_name]: this.dbDriver.from(
                this.dbDriver(parentTable.table_name)
                  .select(parentColumn.column_name)
                  .where(_wherePk(parentTable.primaryKeys, childId))
                  .first()
                  .as('___cn_alias')
              )
            })
            .where(_wherePk(childTable.primaryKeys, rowId));
        }
        break;
    }
  }

  async removeChild({
    colId,
    rowId,
    childId
  }: {
    colId: string;
    rowId: string;
    childId: string;
  }) {
    const columns = await this.model.getColumns();
    const column = columns.find(c => c.id === colId);

    if (!column || column.uidt !== UITypes.LinkToAnotherRecord)
      NcError.notFound('Column not found');

    const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>();

    const childColumn = await colOptions.getChildColumn();
    const parentColumn = await colOptions.getParentColumn();
    const parentTable = await parentColumn.getModel();
    const childTable = await childColumn.getModel();
    await childTable.getColumns();
    await parentTable.getColumns();

    switch (colOptions.type) {
      case RelationTypes.MANY_TO_MANY:
        {
          const vChildCol = await colOptions.getMMChildColumn();
          const vParentCol = await colOptions.getMMParentColumn();
          const vTable = await colOptions.getMMModel();

          await this.dbDriver(vTable.table_name)
            .where({
              [vParentCol.column_name]: this.dbDriver(parentTable.table_name)
                .select(parentColumn.column_name)
                .where(_wherePk(parentTable.primaryKeys, childId))
                .first(),
              [vChildCol.column_name]: this.dbDriver(childTable.table_name)
                .select(childColumn.column_name)
                .where(_wherePk(childTable.primaryKeys, rowId))
                .first()
            })
            .delete();
        }
        break;
      case RelationTypes.HAS_MANY:
        {
          await this.dbDriver(childTable.table_name)
            // .where({
            //   [childColumn.cn]: this.dbDriver(parentTable.tn)
            //     .select(parentColumn.cn)
            //     .where(parentTable.primaryKey.cn, rowId)
            //     .first()
            // })
            .where(_wherePk(childTable.primaryKeys, childId))
            .update({ [childColumn.column_name]: null });
        }
        break;
      case RelationTypes.BELONGS_TO:
        {
          await this.dbDriver(childTable.table_name)
            // .where({
            //   [childColumn.cn]: this.dbDriver(parentTable.tn)
            //     .select(parentColumn.cn)
            //     .where(parentTable.primaryKey.cn, childId)
            //     .first()
            // })
            .where(_wherePk(childTable.primaryKeys, rowId))
            .update({ [childColumn.column_name]: null });
        }
        break;
    }
  }

  private async extractRawQueryAndExec(qb: QueryBuilder) {
    return this.isPg
      ? qb
      : await this.dbDriver.from(
          this.dbDriver.raw(qb.toString()).wrap('(', ') __nc_alias')
        );
  }
}

function extractSortsObject(
  _sorts: string | string[],
  aliasColObjMap: { [columnAlias: string]: Column }
): Sort[] | void {
  if (!_sorts?.length) return;

  let sorts = _sorts;

  if (!Array.isArray(sorts)) sorts = sorts.split(',');

  return sorts.map(s => {
    const sort: SortType = { direction: 'asc' };
    if (s.startsWith('-')) {
      sort.direction = 'desc';
      sort.fk_column_id = aliasColObjMap[s.slice(1)]?.id;
    } else sort.fk_column_id = aliasColObjMap[s]?.id;

    return new Sort(sort);
  });
}

function extractFilterFromXwhere(
  str,
  aliasColObjMap: { [columnAlias: string]: Column }
) {
  if (!str) {
    return [];
  }

  let nestedArrayConditions = [];

  let openIndex = str.indexOf('((');

  if (openIndex === -1) openIndex = str.indexOf('(~');

  let nextOpenIndex = openIndex;
  let closingIndex = str.indexOf('))');

  // if it's a simple query simply return array of conditions
  if (openIndex === -1) {
    if (str && str != '~not')
      nestedArrayConditions = str.split(
        /(?=~(?:or(?:not)?|and(?:not)?|not)\()/
      );
    return extractCondition(nestedArrayConditions || [], aliasColObjMap);
  }

  // iterate until finding right closing
  while (
    (nextOpenIndex = str
      .substring(0, closingIndex)
      .indexOf('((', nextOpenIndex + 1)) != -1
  ) {
    closingIndex = str.indexOf('))', closingIndex + 1);
  }

  if (closingIndex === -1)
    throw new Error(
      `${str
        .substring(0, openIndex + 1)
        .slice(-10)} : Closing bracket not found`
    );

  // getting operand starting index
  const operandStartIndex = str.lastIndexOf('~', openIndex);
  const operator =
    operandStartIndex != -1
      ? str.substring(operandStartIndex + 1, openIndex)
      : '';
  const lhsOfNestedQuery = str.substring(0, openIndex);

  nestedArrayConditions.push(
    ...extractFilterFromXwhere(lhsOfNestedQuery, aliasColObjMap),
    // calling recursively for nested query
    new Filter({
      is_group: true,
      logical_op: operator,
      children: extractFilterFromXwhere(
        str.substring(openIndex + 1, closingIndex + 1),
        aliasColObjMap
      )
    }),
    // RHS of nested query(recursion)
    ...extractFilterFromXwhere(str.substring(closingIndex + 2), aliasColObjMap)
  );
  return nestedArrayConditions;
}

function extractCondition(nestedArrayConditions, aliasColObjMap) {
  return nestedArrayConditions?.map(str => {
    // eslint-disable-next-line prefer-const
    let [logicOp, alias, op, value] =
      str.match(/(?:~(and|or|not))?\((.*?),(\w+),(.*)\)/)?.slice(1) || [];
    if (op === 'in') value = value.split(',');

    return new Filter({
      comparison_op: op,
      fk_column_id: aliasColObjMap[alias]?.id,
      logical_op: logicOp,
      value
    });
  });
}

function applyPaginate(
  query,
  {
    limit = 20,
    offset = 0,
    ignoreLimit = false
  }: XcFilter & { ignoreLimit?: boolean }
) {
  query.offset(offset);
  if (!ignoreLimit) query.limit(limit);

  return query;
}

function _wherePk(primaryKeys: Column[], id) {
  const ids = (id + '').split('___');
  const where = {};
  for (let i = 0; i < primaryKeys.length; ++i) {
    where[primaryKeys[i].column_name] = ids[i];
  }
  return where;
}

function getCompositePk(primaryKeys: Column[], row) {
  return primaryKeys.map(c => row[c.title]).join('___');
}

export function sanitize(v) {
  return v?.replace(/([^\\]|^)([?])/g, '$1\\$2');
}

export { BaseModelSqlv2 };
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
