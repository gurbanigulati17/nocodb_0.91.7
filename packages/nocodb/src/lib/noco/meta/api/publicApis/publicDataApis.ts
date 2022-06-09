import { Request, Response, Router } from 'express';
import Model from '../../../../noco-models/Model';
import { nocoExecute } from 'nc-help';
import Base from '../../../../noco-models/Base';
import NcConnectionMgrv2 from '../../../common/NcConnectionMgrv2';
import { PagedResponseImpl } from '../../helpers/PagedResponse';
import View from '../../../../noco-models/View';
import catchError, { NcError } from '../../helpers/catchError';
import multer from 'multer';
import { ErrorMessages, UITypes, ViewTypes } from 'nocodb-sdk';
import Column from '../../../../noco-models/Column';
import LinkToAnotherRecordColumn from '../../../../noco-models/LinkToAnotherRecordColumn';
import NcPluginMgrv2 from '../../helpers/NcPluginMgrv2';
import path from 'path';
import { nanoid } from 'nanoid';
import { mimeIcons } from '../../../../utils/mimeTypes';
import slash from 'slash';
import { sanitizeUrlPath } from '../attachmentApis';
import getAst from '../../../../dataMapper/lib/sql/helpers/getAst';

export async function dataList(req: Request, res: Response) {
  try {
    const view = await View.getByUUID(req.params.sharedViewUuid);

    if (!view) NcError.notFound('Not found');
    if (view.type !== ViewTypes.GRID) NcError.notFound('Not found');

    if (view.password && view.password !== req.headers?.['xc-password']) {
      return NcError.forbidden(ErrorMessages.INVALID_SHARED_VIEW_PASSWORD);
    }

    const model = await Model.getByIdOrName({
      id: view?.fk_model_id
    });

    const base = await Base.get(model.base_id);

    const baseModel = await Model.getBaseModelSQL({
      id: model.id,
      viewId: view?.id,
      dbDriver: NcConnectionMgrv2.get(base)
    });

    const listArgs: any = { ...req.query };
    try {
      listArgs.filterArr = JSON.parse(listArgs.filterArrJson);
    } catch (e) {}
    try {
      listArgs.sortArr = JSON.parse(listArgs.sortArrJson);
    } catch (e) {}

    const data = await nocoExecute(
      await getAst({
        query: req.query,
        model,
        view
      }),
      await baseModel.list(listArgs),
      {},
      listArgs
    );

    const count = await baseModel.count(listArgs);

    res.json({
      data: new PagedResponseImpl(data, { ...req.query, count })
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({ msg: e.message });
  }
}

async function dataInsert(
  req: Request & { files: any[] },
  res: Response,
  next
) {
  const view = await View.getByUUID(req.params.sharedViewUuid);

  if (!view) return next(new Error('Not found'));
  if (view.type !== ViewTypes.FORM) return next(new Error('Not found'));

  if (view.password && view.password !== req.headers?.['xc-password']) {
    return res.status(403).json(ErrorMessages.INVALID_SHARED_VIEW_PASSWORD);
  }

  const model = await Model.getByIdOrName({
    id: view?.fk_model_id
  });
  const base = await Base.get(model.base_id);
  const project = await base.getProject();

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  await view.getViewWithInfo();
  await view.getColumns();
  await view.getModelWithInfo();
  await view.model.getColumns();

  const fields = (view.model.columns = view.columns
    .filter(c => c.show)
    .reduce((o, c) => {
      o[view.model.columnsById[c.fk_column_id].title] = new Column({
        ...c,
        ...view.model.columnsById[c.fk_column_id]
      } as any);
      return o;
    }, {}) as any);

  let body = req.body?.data;

  if (typeof body === 'string') body = JSON.parse(body);

  const insertObject = Object.entries(body).reduce((obj, [key, val]) => {
    if (key in fields) {
      obj[key] = val;
    }
    return obj;
  }, {});

  const attachments = {};
  const storageAdapter = await NcPluginMgrv2.storageAdapter();

  for (const file of req.files || []) {
    // remove `_` prefix and `[]` suffix
    const fieldName = file?.fieldname?.replace(/^_|\[\d*]$/g, '');

    const filePath = sanitizeUrlPath([
      'noco',
      project.title,
      model.title,
      fieldName
    ]);

    if (fieldName in fields && fields[fieldName].uidt === UITypes.Attachment) {
      attachments[fieldName] = attachments[fieldName] || [];
      const fileName = `${nanoid(6)}_${file.originalname}`;
      let url = await storageAdapter.fileCreate(
        slash(path.join('nc', 'uploads', ...filePath, fileName)),
        file
      );

      if (!url) {
        url = `${(req as any).ncSiteUrl}/download/${filePath.join(
          '/'
        )}/${fileName}`;
      }

      attachments[fieldName].push({
        url,
        title: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        icon: mimeIcons[path.extname(file.originalname).slice(1)] || undefined
      });
    }
  }

  for (const [column, data] of Object.entries(attachments)) {
    insertObject[column] = JSON.stringify(data);
  }

  res.json(await baseModel.nestedInsert(insertObject, null));
}

async function relDataList(req, res) {
  const view = await View.getByUUID(req.params.sharedViewUuid);

  if (!view) NcError.notFound('Not found');
  if (view.type !== ViewTypes.FORM) NcError.notFound('Not found');

  if (view.password && view.password !== req.headers?.['xc-password']) {
    NcError.forbidden(ErrorMessages.INVALID_SHARED_VIEW_PASSWORD);
  }

  const column = await Column.get({ colId: req.params.columnId });
  const colOptions = await column.getColOptions<LinkToAnotherRecordColumn>();

  const model = await colOptions.getRelatedTable();

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  const requestObj = await getAst({
    query: req.query,
    model,
    extractOnlyPrimaries: true
  });

  const data = await nocoExecute(
    requestObj,
    await baseModel.list(req.query),
    {},
    req.query
  );

  const count = await baseModel.count(req.query);

  res.json(new PagedResponseImpl(data, { ...req.query, count }));
}

export async function publicMmList(req: Request, res: Response) {
  const view = await View.getByUUID(req.params.sharedViewUuid);

  if (!view) NcError.notFound('Not found');
  if (view.type !== ViewTypes.GRID) NcError.notFound('Not found');

  if (view.password && view.password !== req.headers?.['xc-password']) {
    NcError.forbidden(ErrorMessages.INVALID_SHARED_VIEW_PASSWORD);
  }

  const column = await Column.get({ colId: req.params.colId });

  if (column.fk_model_id !== view.fk_model_id)
    NcError.badRequest("Column doesn't belongs to the model");

  const base = await Base.get(view.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: view.fk_model_id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  const key = `List`;
  const requestObj: any = {
    [key]: 1
  };

  const data = (
    await nocoExecute(
      requestObj,
      {
        [key]: async args => {
          return await baseModel.mmList(
            {
              colId: req.params.colId,
              parentId: req.params.rowId
            },
            args
          );
        }
      },
      {},

      { nested: { [key]: req.query } }
    )
  )?.[key];

  const count: any = await baseModel.mmListCount({
    colId: req.params.colId,
    parentId: req.params.rowId
  });

  res.json(new PagedResponseImpl(data, { ...req.query, count }));
}

export async function publicHmList(req: Request, res: Response) {
  const view = await View.getByUUID(req.params.sharedViewUuid);

  if (!view) NcError.notFound('Not found');
  if (view.type !== ViewTypes.GRID) NcError.notFound('Not found');

  if (view.password && view.password !== req.headers?.['xc-password']) {
    NcError.forbidden(ErrorMessages.INVALID_SHARED_VIEW_PASSWORD);
  }

  const column = await Column.get({ colId: req.params.colId });

  if (column.fk_model_id !== view.fk_model_id)
    NcError.badRequest("Column doesn't belongs to the model");

  const base = await Base.get(view.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: view.fk_model_id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  const key = `List`;
  const requestObj: any = {
    [key]: 1
  };

  const data = (
    await nocoExecute(
      requestObj,
      {
        [key]: async args => {
          return await baseModel.hmList(
            {
              colId: req.params.colId,
              id: req.params.rowId
            },
            args
          );
        }
      },
      {},
      { nested: { [key]: req.query } }
    )
  )?.[key];

  const count = await baseModel.hmListCount({
    colId: req.params.colId,
    id: req.params.rowId
  });

  res.json(
    new PagedResponseImpl(data, {
      totalRows: count
    } as any)
  );
}

const router = Router({ mergeParams: true });
router.get(
  '/api/v1/db/public/shared-view/:sharedViewUuid/rows',
  catchError(dataList)
);
router.get(
  '/api/v1/db/public/shared-view/:sharedViewUuid/nested/:columnId',
  catchError(relDataList)
);
router.post(
  '/api/v1/db/public/shared-view/:sharedViewUuid/rows',
  multer({
    storage: multer.diskStorage({})
  }).any(),
  catchError(dataInsert)
);

router.get(
  '/api/v1/db/public/shared-view/:sharedViewUuid/rows/:rowId/mm/:colId',
  catchError(publicMmList)
);
router.get(
  '/api/v1/db/public/shared-view/:sharedViewUuid/rows/:rowId/hm/:colId',
  catchError(publicHmList)
);

export default router;
