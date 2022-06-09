import autoBind from 'auto-bind';

import { Acls } from '../../../interface/config';
import { BaseModelSql } from '../../dataMapper';
import Noco from '../Noco';

import GqlBaseResolver from './GqlBaseResolver';
import GqlMiddleware from './GqlMiddleware';

function parseHrtimeToSeconds(hrtime) {
  const seconds = (hrtime[0] + hrtime[1] / 1e6).toFixed(3);
  return seconds;
}

export default class GqlResolver extends GqlBaseResolver {
  // @ts-ignore
  private app: Noco;
  private models: { [key: string]: BaseModelSql };
  private table: string;
  private typeClass: new (obj: any) => any;
  private acls: Acls;
  private functions: { [key: string]: any };
  private middlewareStringBody?: string;

  constructor(
    app: Noco,
    models: { [key: string]: BaseModelSql },
    table: string,
    typeClass: { new (obj: any): any },
    acls: Acls,
    functions: { [key: string]: string[] },
    middlewareStringBody?: string
  ) {
    super();
    autoBind(this);
    this.app = app;
    this.models = models;
    this.table = table;
    this.typeClass = typeClass;
    this.acls = acls;
    this.functions = functions;
    this.middlewareStringBody = middlewareStringBody;
  }

  private get model(): BaseModelSql {
    return this.models?.[this.table];
  }

  public async list(
    args,
    { req, res }: { req: any & { model: BaseModelSql }; res: any }
  ): Promise<any> {
    const startTime = process.hrtime();
    try {
      if (args.conditionGraph && typeof args.conditionGraph === 'string') {
        args.conditionGraph = {
          models: this.models,
          condition: JSON.parse(args.conditionGraph)
        };
      }
      if (args.condition && typeof args.condition === 'string') {
        args.condition = JSON.parse(args.condition);
      }
    } catch (e) {
      /* ignore parse error */
    }
    const data = await req.model.list(args);
    const elapsedSeconds = parseHrtimeToSeconds(process.hrtime(startTime));
    res.setHeader('xc-db-response', elapsedSeconds);

    return data.map(o => {
      return new req.gqlType(o);
    });
  }

  public async create(args, { req }): Promise<any> {
    const data = await req.model.insert(args.data, null, req);
    return new req.gqlType(data);
  }

  public async read(args, { req }): Promise<any> {
    const data = await req.model.readByPk(args.id, args);
    return new req.gqlType(data);
  }

  public async update(args, { req }): Promise<any> {
    const data = await req.model.updateByPk(args.id, args.data, null, req);
    return data;
  }

  public async delete(args, { req }): Promise<any> {
    const data = await req.model.delByPk(args.id, null, req);
    return data;
  }

  public async exists(args, { req }): Promise<any> {
    const data = await req.model.exists(args.id, args);
    return data;
  }

  public async findOne(args, { req }): Promise<any> {
    const data = await req.model.findOne(args);
    return new req.gqlType(data);
  }

  public async groupBy(args, { req }): Promise<any> {
    const data = await req.model.groupBy(args);
    return data;
  }

  public async aggregate(args, { req }): Promise<any> {
    const data = await req.model.aggregate(args);
    return data;
  }

  public async distinct(args, { req }): Promise<any> {
    const data = (await req.model.distinct(args)).map(d => new req.gqlType(d));
    return data;
  }

  public async count(args, { req }): Promise<any> {
    try {
      if (args.conditionGraph && typeof args.conditionGraph === 'string') {
        args.conditionGraph = {
          models: this.models,
          condition: JSON.parse(args.conditionGraph)
        };
      }
      if (args.condition && typeof args.condition === 'string') {
        args.condition = JSON.parse(args.condition);
      }
    } catch (e) {
      /* ignore parse error */
    }
    const data = await req.model.countByPk(args);
    return data.count;
  }

  public async distribution(args, { req }): Promise<any> {
    const data = await req.model.distribution(args);
    return data;
  }

  public async createb(args, { req }): Promise<any> {
    const data = await req.model.insertb(args.data);
    return data;
  }

  public async updateb(args, { req }): Promise<any> {
    const data = await req.model.updateb(args.data);
    return data;
  }

  public async deleteb(args, { req }): Promise<any> {
    const data = await req.model.delb(args.data);
    return data;
  }

  public updateMiddlewareBody(body: string): this {
    this.middlewareStringBody = body;
    return this;
  }

  public mapResolvers(customResolver: any): any {
    const mw = new GqlMiddleware(
      this.acls,
      this.table,
      this.middlewareStringBody,
      this.models
    );
    // todo: replace with inflection
    const name = this.model._tn;
    return GqlResolver.applyMiddlewares(
      [
        (_, { req }) => {
          req.models = this.models;
          req.model = this.model;
          req.gqlType = this.typeClass;
        },
        mw.middleware
      ],
      {
        ...(customResolver?.additional?.[this.table] || {}),

        [`${name}List`]:
          customResolver?.override?.[`${name}List`] ||
          this.generateResolverFromStringBody(this.functions[`${name}List`]) ||
          this.list,
        [`${name}FindOne`]:
          customResolver?.override?.[`${name}FindOne`] ||
          this.generateResolverFromStringBody(
            this.functions[`${name}FindOne`]
          ) ||
          this.findOne,
        [`${name}Count`]:
          customResolver?.override?.[`${name}Count`] ||
          this.generateResolverFromStringBody(this.functions[`${name}Count`]) ||
          this.count,
        [`${name}Distinct`]:
          customResolver?.override?.[`${name}Distinct`] ||
          this.generateResolverFromStringBody(
            this.functions[`${name}Distinct`]
          ) ||
          this.distinct,
        [`${name}GroupBy`]:
          customResolver?.override?.[`${name}GroupBy`] ||
          this.generateResolverFromStringBody(
            this.functions[`${name}GroupBy`]
          ) ||
          this.groupBy,
        [`${name}Aggregate`]:
          customResolver?.override?.[`${name}Aggregate`] ||
          this.generateResolverFromStringBody(
            this.functions[`${name}Aggregate`]
          ) ||
          this.aggregate,
        [`${name}Distribution`]:
          customResolver?.override?.[`${name}Distribution`] ||
          this.generateResolverFromStringBody(
            this.functions[`${name}Distribution`]
          ) ||
          this.distribution,
        ...(this.model.type === 'table'
          ? {
              [`${name}Read`]:
                customResolver?.override?.[`${name}Read`] ||
                this.generateResolverFromStringBody(
                  this.functions[`${name}Read`]
                ) ||
                this.read,
              [`${name}Exists`]:
                customResolver?.override?.[`${name}Exists`] ||
                this.generateResolverFromStringBody(
                  this.functions[`${name}Exists`]
                ) ||
                this.exists,
              [`${name}Create`]:
                customResolver?.override?.[`${name}Create`] ||
                this.generateResolverFromStringBody(
                  this.functions[`${name}Create`]
                ) ||
                this.create,
              [`${name}Update`]:
                customResolver?.override?.[`${name}Update`] ||
                this.generateResolverFromStringBody(
                  this.functions[`${name}Update`]
                ) ||
                this.update,
              [`${name}Delete`]:
                customResolver?.override?.[`${name}Delete`] ||
                this.generateResolverFromStringBody(
                  this.functions[`${name}Delete`]
                ) ||
                this.delete,
              [`${name}CreateBulk`]:
                customResolver?.override?.[`${name}CreateBulk`] ||
                this.generateResolverFromStringBody(
                  this.functions[`${name}CreateBulk`]
                ) ||
                this.createb,
              [`${name}UpdateBulk`]:
                customResolver?.override?.[`${name}UpdateBulk`] ||
                this.generateResolverFromStringBody(
                  this.functions[`${name}UpdateBulk`]
                ) ||
                this.updateb,
              [`${name}DeleteBulk`]:
                customResolver?.override?.[`${name}DeleteBulk`] ||
                this.generateResolverFromStringBody(
                  this.functions[`${name}DeleteBulk`]
                ) ||
                this.deleteb
            }
          : {})
      },
      [mw.postMiddleware]
    );
  }
}
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
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
