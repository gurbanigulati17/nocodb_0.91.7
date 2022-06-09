import { Request, Response, Router } from 'express';
import View from '../../../noco-models/View';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import { extractCsvData } from './dataApis/helpers';

async function exportCsv(req: Request, res: Response) {
  const view = await View.get(req.params.viewId);
  const { offset, elapsed, data } = await extractCsvData(view, req);

  res.set({
    'Access-Control-Expose-Headers': 'nc-export-offset',
    'nc-export-offset': offset,
    'nc-export-elapsed-time': elapsed,
    'Content-Disposition': `attachment; filename="${view.title}-export.csv"`
  });
  res.send(data);
}

const router = Router({ mergeParams: true });
router.get('/data/:viewId/export/csv', ncMetaAclMw(exportCsv, 'exportCsv'));
export default router;
