import Project from '../../../../noco-models/Project';
import Model from '../../../../noco-models/Model';
import View from '../../../../noco-models/View';
import { NcError } from '../../helpers/catchError';
import { Request } from 'express';
import Base from '../../../../noco-models/Base';
import NcConnectionMgrv2 from '../../../common/NcConnectionMgrv2';
import { isSystemColumn, UITypes } from 'nocodb-sdk';

import { nocoExecute } from 'nc-help';
import Column from '../../../../noco-models/Column';
import LookupColumn from '../../../../noco-models/LookupColumn';
import LinkToAnotherRecordColumn from '../../../../noco-models/LinkToAnotherRecordColumn';

import papaparse from 'papaparse';
import getAst from '../../../../dataMapper/lib/sql/helpers/getAst';
export async function getViewAndModelFromRequestByAliasOrId(
  req:
    | Request<{ projectName: string; tableName: string; viewName?: string }>
    | Request
) {
  const project = await Project.getWithInfoByTitleOrId(req.params.projectName);

  const model = await Model.getByAliasOrId({
    project_id: project.id,
    base_id: project.bases?.[0]?.id,
    aliasOrId: req.params.tableName
  });
  const view =
    req.params.viewName &&
    (await View.getByTitleOrId({
      titleOrId: req.params.viewName,
      fk_model_id: model.id
    }));
  if (!model) NcError.notFound('Table not found');
  return { model, view };
}

export async function extractCsvData(view: View, req: Request) {
  const base = await Base.get(view.base_id);

  await view.getModelWithInfo();
  await view.getColumns();

  view.model.columns = view.columns
    .filter(c => c.show)
    .map(
      c =>
        new Column({ ...c, ...view.model.columnsById[c.fk_column_id] } as any)
    )
    .filter(column => !isSystemColumn(column) || view.show_system_fields);

  const baseModel = await Model.getBaseModelSQL({
    id: view.model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  let offset = +req.query.offset || 0;
  const limit = 100;
  // const size = +process.env.NC_EXPORT_MAX_SIZE || 1024;
  const timeout = +process.env.NC_EXPORT_MAX_TIMEOUT || 5000;
  const csvRows = [];
  const startTime = process.hrtime();
  let elapsed, temp;

  for (
    elapsed = 0;
    elapsed < timeout;
    offset += limit,
      temp = process.hrtime(startTime),
      elapsed = temp[0] * 1000 + temp[1] / 1000000
  ) {
    const rows = await nocoExecute(
      await getAst({
        query: req.query,
        includePkByDefault: false,
        model: view.model,
        view
      }),
      await baseModel.list({ ...req.query, offset, limit }),
      {},
      req.query
    );

    if (!rows?.length) {
      offset = -1;
      break;
    }

    for (const row of rows) {
      const csvRow = { ...row };

      for (const column of view.model.columns) {
        if (isSystemColumn(column) && !view.show_system_fields) continue;
        csvRow[column.title] = await serializeCellValue({
          value: row[column.title],
          column
        });
      }
      csvRows.push(csvRow);
    }
  }

  const data = papaparse.unparse(
    {
      fields: view.model.columns.map(c => c.title),
      data: csvRows
    },
    {
      escapeFormulae: true
    }
  );

  return { offset, csvRows, elapsed, data };
}

export async function serializeCellValue({
  value,
  column
}: {
  column?: Column;
  value: any;
}) {
  if (!column) {
    return value;
  }

  if (!value) return value;

  switch (column?.uidt) {
    case UITypes.Attachment: {
      let data = value;
      try {
        if (typeof value === 'string') {
          data = JSON.parse(value);
        }
      } catch {}

      return (data || []).map(
        attachment =>
          `${encodeURI(attachment.title)}(${encodeURI(attachment.url)})`
      );
    }
    case UITypes.Lookup:
      {
        const colOptions = await column.getColOptions<LookupColumn>();
        const lookupColumn = await colOptions.getLookupColumn();
        return (
          await Promise.all(
            [...(Array.isArray(value) ? value : [value])].map(async v =>
              serializeCellValue({
                value: v,
                column: lookupColumn
              })
            )
          )
        ).join(', ');
      }
      break;
    case UITypes.LinkToAnotherRecord:
      {
        const colOptions = await column.getColOptions<
          LinkToAnotherRecordColumn
        >();
        const relatedModel = await colOptions.getRelatedTable();
        await relatedModel.getColumns();
        return [...(Array.isArray(value) ? value : [value])]
          .map(v => {
            return v[relatedModel.primaryValue?.title];
          })
          .join(', ');
      }
      break;
    default:
      if (value && typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value;
  }
}
