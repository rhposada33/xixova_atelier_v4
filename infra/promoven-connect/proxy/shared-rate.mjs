// A restricted JWT role can execute only this atomic SQL limiter. Fail closed.
export function sharedRate({url, token, fetcher=fetch}) {
  return async key => {
    const response = await fetcher(`${url}/rpc/connect_proxy_rate`, {
      method: 'POST', headers: {authorization:`Bearer ${token}`, 'content-type':'application/json'},
      body: JSON.stringify({p_key:key}), signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) throw Error('rate_unavailable');
    const allowed = await response.json();
    if (typeof allowed !== 'boolean') throw Error('rate_unavailable');
    return allowed;
  };
}
