import { Request, Response, Router } from 'express';
import Model from '../../../../noco-models/Model';
import Base from '../../../../noco-models/Base';
import NcConnectionMgrv2 from '../../../common/NcConnectionMgrv2';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import ncMetaAclMw from '../../helpers/ncMetaAclMw';
import { getViewAndModelFromRequestByAliasOrId } from './helpers';
import { NcError } from '../../helpers/catchError';
import apiMetrics from '../../helpers/apiMetrics';

export async function mmList(req: Request, res: Response, next) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);

  if (!model) return next(new Error('Table not found'));

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  const column = await getColumnByIdOrName(req.params.columnName, model);

  const data = await baseModel.mmList(
    {
      colId: column.id,
      parentId: req.params.rowId
    },
    req.query as any
  );
  const count: any = await baseModel.mmListCount({
    colId: column.id,
    parentId: req.params.rowId
  });

  res.json(
    new PagedResponseImpl(data, {
      count,
      ...req.query
    })
  );
}

export async function mmExcludedList(req: Request, res: Response, next) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  if (!model) return next(new Error('Table not found'));

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });
  const column = await getColumnByIdOrName(req.params.columnName, model);

  const data = await baseModel.getMmChildrenExcludedList(
    {
      colId: column.id,
      pid: req.params.rowId
    },
    req.query
  );

  const count = await baseModel.getMmChildrenExcludedListCount(
    {
      colId: column.id,
      pid: req.params.rowId
    },
    req.query
  );

  res.json(
    new PagedResponseImpl(data, {
      count,
      ...req.query
    })
  );
}

export async function hmExcludedList(req: Request, res: Response, next) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);

  if (!model) return next(new Error('Table not found'));

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  const column = await getColumnByIdOrName(req.params.columnName, model);

  const data = await baseModel.getHmChildrenExcludedList(
    {
      colId: column.id,
      pid: req.params.rowId
    },
    req.query
  );

  const count = await baseModel.getHmChildrenExcludedListCount(
    {
      colId: column.id,
      pid: req.params.rowId
    },
    req.query
  );

  res.json(
    new PagedResponseImpl(data, {
      count,
      ...req.query
    })
  );
}

export async function btExcludedList(req: Request, res: Response, next) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  if (!model) return next(new Error('Table not found'));

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  const column = await getColumnByIdOrName(req.params.columnName, model);

  const data = await baseModel.getBtChildrenExcludedList(
    {
      colId: column.id,
      cid: req.params.rowId
    },
    req.query
  );

  const count = await baseModel.getBtChildrenExcludedListCount(
    {
      colId: column.id,
      cid: req.params.rowId
    },
    req.query
  );

  res.json(
    new PagedResponseImpl(data, {
      count,
      ...req.query
    })
  );
}

export async function hmList(req: Request, res: Response, next) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  if (!model) return next(new Error('Table not found'));

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  const column = await getColumnByIdOrName(req.params.columnName, model);

  const data = await baseModel.hmList(
    {
      colId: column.id,
      id: req.params.rowId
    },
    req.query
  );

  const count = await baseModel.hmListCount({
    colId: column.id,
    id: req.params.rowId
  });

  res.json(
    new PagedResponseImpl(data, {
      totalRows: count
    } as any)
  );
}

//@ts-ignore
async function relationDataRemove(req, res) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);

  if (!model) NcError.notFound('Table not found');

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  const column = await getColumnByIdOrName(req.params.columnName, model);

  await baseModel.removeChild({
    colId: column.id,
    childId: req.params.refRowId,
    rowId: req.params.rowId
  });

  res.json({ msg: 'success' });
}

//@ts-ignore
async function relationDataAdd(req, res) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  if (!model) NcError.notFound('Table not found');

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  const column = await getColumnByIdOrName(req.params.columnName, model);
  await baseModel.addChild({
    colId: column.id,
    childId: req.params.refRowId,
    rowId: req.params.rowId
  });

  res.json({ msg: 'success' });
}

async function getColumnByIdOrName(columnNameOrId: string, model: Model) {
  const column = (await model.getColumns()).find(
    c =>
      c.title === columnNameOrId ||
      c.id === columnNameOrId ||
      c.column_name === columnNameOrId
  );

  if (!column)
    NcError.notFound(`Column with id/name '${columnNameOrId}' is not found`);

  return column;
}

const router = Router({ mergeParams: true });

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/mm/:columnName/exclude',
  apiMetrics,
  ncMetaAclMw(mmExcludedList, 'mmExcludedList')
);
router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/hm/:columnName/exclude',
  apiMetrics,
  ncMetaAclMw(hmExcludedList, 'hmExcludedList')
);
router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/bt/:columnName/exclude',
  apiMetrics,
  ncMetaAclMw(btExcludedList, 'btExcludedList')
);

router.post(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/:relationType/:columnName/:refRowId',
  apiMetrics,
  ncMetaAclMw(relationDataAdd, 'relationDataAdd')
);
router.delete(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/:relationType/:columnName/:refRowId',
  apiMetrics,
  ncMetaAclMw(relationDataRemove, 'relationDataRemove')
);

router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/mm/:columnName',
  apiMetrics,
  ncMetaAclMw(mmList, 'mmList')
);
router.get(
  '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/hm/:columnName',
  apiMetrics,
  ncMetaAclMw(hmList, 'hmList')
);

export default router;
