---
title: 'NocoDB SDK'
description: 'SDK'
position: 1400
category: 'Developer Resources'
menuTitle: 'NocoDB SDK'
---

We provide SDK for users to integrate with their applications. Currently only SDK for Javascript is supported.

<alert>
Note: The NocoDB SDK requires authorization token. If you haven't created one, please check out <a href="./accessing-apis" target="_blank">Accessing APIs</a> for details.
</alert>

## SDK For Javascript

### Install nocodb-sdk

```bash
npm i nocodb-sdk
```

### Import Api

```js
import { Api } from 'nocodb-sdk'
```

### Configure Api

The Api can be authorizated by either Auth Token or API Token.

#### Example: Auth Token

```js
const api = new Api({
  baseURL: 'https://<HOST>:<PORT>',
  headers: {
    'xc-auth': '<AUTH_TOKEN>'
  }
})
```

#### Example: API Token

```js
const api = new Api({
  baseURL: 'https://<HOST>:<PORT>',
  headers: {
    'xc-token': '<API_TOKEN>'
  }
})
```

### Call Functions

Once you have configured `api`, you can call different types of APIs by `api.<Tag>.<FunctionName>`. 

<alert>
For Tag and FunctionName, please check out the API table <a href="./rest-apis" target="_blank">here</a>.
</alert>

#### Example: Calling API - /api/v1/db/meta/projects/{projectId}/tables

```js
await api.dbTable.create(params)
```