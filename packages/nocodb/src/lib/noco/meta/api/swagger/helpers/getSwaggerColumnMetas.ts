import { UITypes } from 'nocodb-sdk';
import LinkToAnotherRecordColumn from '../../../../../noco-models/LinkToAnotherRecordColumn';
import SwaggerTypes from '../../../../../sqlMgr/code/routers/xc-ts/SwaggerTypes';
import Column from '../../../../../noco-models/Column';
import Noco from '../../../../Noco';
import Project from '../../../../../noco-models/Project';

export default async (
  columns: Column[],
  project: Project,
  ncMeta = Noco.ncMeta
): Promise<SwaggerColumn[]> => {
  const dbType = await project.getBases().then(b => b?.[0]?.type);
  return Promise.all(
    columns.map(async c => {
      const field: SwaggerColumn = {
        title: c.title,
        type: 'object',
        virtual: true,
        column: c
      };

      switch (c.uidt) {
        case UITypes.LinkToAnotherRecord:
          {
            const colOpt = await c.getColOptions<LinkToAnotherRecordColumn>(
              ncMeta
            );
            if (colOpt) {
              const relTable = await colOpt.getRelatedTable(ncMeta);
              field.type = undefined;
              field.$ref = `#/components/schemas/${relTable.title}Request`;
            }
          }
          break;
        case UITypes.Formula:
        case UITypes.Lookup:
          field.type = 'object';
          break;
        case UITypes.Rollup:
          field.type = 'number';
          break;
        default:
          field.virtual = false;
          SwaggerTypes.setSwaggerType(c, field, dbType);
          break;
      }

      return field;
    })
  );
};

export interface SwaggerColumn {
  type: any;
  title: string;
  description?: string;
  virtual?: boolean;
  $ref?: any;
  column: Column;
}
