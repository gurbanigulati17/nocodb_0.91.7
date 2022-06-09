// // Project CRUD
import { Request, Response } from 'express';

import { packageVersion } from 'nc-help';
import ncMetaAclMw from '../helpers/ncMetaAclMw';
import SqlMgrv2 from '../../../sqlMgr/v2/SqlMgrv2';
import { defaultConnectionConfig } from '../../../utils/NcConfigFactory';
import User from '../../../noco-models/User';
import catchError from '../helpers/catchError';
import axios from 'axios';

export async function testConnection(req: Request, res: Response) {
  res.json(await SqlMgrv2.testConnection(req.body));
}
export async function appInfo(req: Request, res: Response) {
  const projectHasAdmin = !(await User.isFirst());
  const result = {
    authType: 'jwt',
    projectHasAdmin,
    firstUser: !projectHasAdmin,
    type: 'rest',
    env: process.env.NODE_ENV,
    googleAuthEnabled: !!(
      process.env.NC_GOOGLE_CLIENT_ID && process.env.NC_GOOGLE_CLIENT_SECRET
    ),
    githubAuthEnabled: !!(
      process.env.NC_GITHUB_CLIENT_ID && process.env.NC_GITHUB_CLIENT_SECRET
    ),
    oneClick: !!process.env.NC_ONE_CLICK,
    connectToExternalDB: !process.env.NC_CONNECT_TO_EXTERNAL_DB_DISABLED,
    version: packageVersion,
    defaultLimit: Math.max(
      Math.min(
        +process.env.DB_QUERY_LIMIT_DEFAULT || 25,
        +process.env.DB_QUERY_LIMIT_MAX || 100
      ),
      +process.env.DB_QUERY_LIMIT_MIN || 1
    ),
    timezone: defaultConnectionConfig.timezone,
    ncMin: !!process.env.NC_MIN,
    teleEnabled: !process.env.NC_DISABLE_TELE,
    ncSiteUrl: (req as any).ncSiteUrl
  };

  res.json(result);
}

export async function releaseVersion(_req: Request, res: Response) {
  const result = await axios
    .get('https://github.com/nocodb/nocodb/releases/latest')
    .then(response => {
      return {
        releaseVersion: response.request.res.responseUrl.replace(
          'https://github.com/nocodb/nocodb/releases/tag/',
          ''
        )
      };
    });

  res.json(result);
}

export async function axiosRequestMake(req: Request, res: Response) {
  const { apiMeta } = req.body;
  if (apiMeta?.body) {
    try {
      apiMeta.body = JSON.parse(apiMeta.body);
    } catch (e) {
      console.log(e);
    }
  }

  if (apiMeta?.auth) {
    try {
      apiMeta.auth = JSON.parse(apiMeta.auth);
    } catch (e) {
      console.log(e);
    }
  }

  apiMeta.response = {};
  const _req = {
    params: apiMeta.parameters
      ? apiMeta.parameters.reduce((paramsObj, param) => {
          if (param.name && param.enabled) {
            paramsObj[param.name] = param.value;
          }
          return paramsObj;
        }, {})
      : {},
    url: apiMeta.url,
    method: apiMeta.method || 'GET',
    data: apiMeta.body || {},
    headers: apiMeta.headers
      ? apiMeta.headers.reduce((headersObj, header) => {
          if (header.name && header.enabled) {
            headersObj[header.name] = header.value;
          }
          return headersObj;
        }, {})
      : {},
    responseType: apiMeta.responseType || 'json',
    withCredentials: true
  };
  const data = await require('axios')(_req);
  return res.json(data?.data);
}

export default router => {
  router.post(
    '/api/v1/db/meta/connection/test',
    ncMetaAclMw(testConnection, 'testConnection')
  );
  router.get('/api/v1/db/meta/nocodb/info', catchError(appInfo));
  router.get('/api/v1/db/meta/nocodb/version', catchError(releaseVersion));
  router.post('/api/v1/db/meta/axiosRequestMake', catchError(axiosRequestMake));
};
