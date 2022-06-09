import { Request, Response, Router } from 'express';
import Model from '../../../../noco-models/Model';
import Base from '../../../../noco-models/Base';
import NcConnectionMgrv2 from '../../../common/NcConnectionMgrv2';
import ncMetaAclMw from '../../helpers/ncMetaAclMw';
import { getViewAndModelFromRequestByAliasOrId } from './helpers';
import apiMetrics from '../../helpers/apiMetrics';

async function bulkDataInsert(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);

  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  res.json(await baseModel.bulkInsert(req.body));
}

async function bulkDataUpdate(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  res.json(await baseModel.bulkUpdate(req.body));
}

async function bulkDataUpdateAll(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  const base = await Base.get(model.base_id);

  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  res.json(await baseModel.bulkUpdateAll(req.query, req.body));
}

async function bulkDataDelete(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  const base = await Base.get(model.base_id);
  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  res.json(await baseModel.bulkDelete(req.body));
}

async function bulkDataDeleteAll(req: Request, res: Response) {
  const { model, view } = await getViewAndModelFromRequestByAliasOrId(req);
  const base = await Base.get(model.base_id);
  const baseModel = await Model.getBaseModelSQL({
    id: model.id,
    viewId: view?.id,
    dbDriver: NcConnectionMgrv2.get(base)
  });

  res.json(await baseModel.bulkDeleteAll(req.query));
}
const router = Router({ mergeParams: true });

router.post(
  '/api/v1/db/data/bulk/:orgs/:projectName/:tableName',
  apiMetrics,
  ncMetaAclMw(bulkDataInsert, 'bulkDataInsert')
);
router.patch(
  '/api/v1/db/data/bulk/:orgs/:projectName/:tableName',
  apiMetrics,
  ncMetaAclMw(bulkDataUpdate, 'bulkDataUpdate')
);
router.patch(
  '/api/v1/db/data/bulk/:orgs/:projectName/:tableName/all',
  apiMetrics,
  ncMetaAclMw(bulkDataUpdateAll, 'bulkDataUpdateAll')
);
router.delete(
  '/api/v1/db/data/bulk/:orgs/:projectName/:tableName',
  apiMetrics,
  ncMetaAclMw(bulkDataDelete, 'bulkDataDelete')
);
router.delete(
  '/api/v1/db/data/bulk/:orgs/:projectName/:tableName/all',
  apiMetrics,
  ncMetaAclMw(bulkDataDeleteAll, 'bulkDataDeleteAll')
);

export default router;
