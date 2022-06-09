import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable
} from '../utils/globals';
import Noco from '../noco/Noco';
import { nanoid } from 'nanoid';
import NocoCache from '../noco-cache/NocoCache';

export default class ApiToken {
  project_id?: string;
  db_alias?: string;
  description?: string;
  permissions?: string;
  token?: string;
  expiry?: string;
  enabled?: boolean;

  constructor(audit: Partial<ApiToken>) {
    Object.assign(this, audit);
  }

  public static async insert(
    apiToken: Partial<ApiToken>,
    ncMeta = Noco.ncMeta
  ) {
    const token = nanoid(40);
    await ncMeta.metaInsert(null, null, MetaTable.API_TOKENS, {
      description: apiToken.description,
      token
    });
    await NocoCache.appendToList(
      CacheScope.API_TOKEN,
      [],
      `${CacheScope.API_TOKEN}:${token}`
    );
    return this.getByToken(token);
  }

  static async list(ncMeta = Noco.ncMeta) {
    let tokens = await NocoCache.getList(CacheScope.API_TOKEN, []);
    if (!tokens.length) {
      tokens = await ncMeta.metaList(null, null, MetaTable.API_TOKENS);
      await NocoCache.setList(CacheScope.API_TOKEN, [], tokens);
    }
    return tokens?.map(t => new ApiToken(t));
  }
  static async delete(token, ncMeta = Noco.ncMeta) {
    await NocoCache.deepDel(
      CacheScope.API_TOKEN,
      `${CacheScope.API_TOKEN}:${token}`,
      CacheDelDirection.CHILD_TO_PARENT
    );
    return await ncMeta.metaDelete(null, null, MetaTable.API_TOKENS, { token });
  }

  static async getByToken(token, ncMeta = Noco.ncMeta) {
    let data =
      token &&
      (await NocoCache.get(
        `${CacheScope.API_TOKEN}:${token}`,
        CacheGetType.TYPE_OBJECT
      ));
    if (!data) {
      data = await ncMeta.metaGet(null, null, MetaTable.API_TOKENS, { token });
      await NocoCache.set(`${CacheScope.API_TOKEN}:${token}`, data);
    }
    return data && new ApiToken(data);
  }
}
