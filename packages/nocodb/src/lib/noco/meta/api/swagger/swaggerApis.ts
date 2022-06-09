// @ts-ignore
import catchError, { NcError } from '../../helpers/catchError';
import { Router } from 'express';
import Model from '../../../../noco-models/Model';
import getSwaggerJSON from './helpers/getSwaggerJSON';
import Project from '../../../../noco-models/Project';
import swaggerHtml from './swaggerHtml';
import redocHtml from './redocHtml';

async function swaggerJson(req, res) {
  const project = await Project.get(req.params.projectId);

  if (!project) NcError.notFound();

  const models = await Model.list({
    project_id: req.params.projectId,
    base_id: null
  });

  const swagger = await getSwaggerJSON(project, models);

  swagger.servers = [
    {
      url: req.ncSiteUrl
    },
    {
      url: '{customUrl}',
      variables: {
        customUrl: {
          default: req.ncSiteUrl,
          description: 'Provide custom nocodb app base url'
        }
      }
    }
  ] as any;

  res.json(swagger);
}

const router = Router({ mergeParams: true });

// todo: auth
router.get(
  '/api/v1/db/meta/projects/:projectId/swagger.json',
  catchError(swaggerJson)
);
router.get('/api/v1/db/meta/projects/:projectId/swagger', (_req, res) =>
  res.send(swaggerHtml)
);
router.get('/api/v1/db/meta/projects/:projectId/redoc', (_req, res) =>
  res.send(redocHtml)
);

export default router;
