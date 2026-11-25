// 發布前檢查: do the outside links on the changed pages still open? Only a
// clear answer counts as broken — 404 / 410, a DOI that does not exist, or a
// site that cannot be reached at all. Publishers that turn robots away (403),
// slow sites (timeouts) and anything else are left alone, so teachers are not
// sent chasing links that work fine in a browser.
const UA = "Mozilla/5.0 (compatible; LabSite link check; +https://labsite-sites.shiftguard-navicare.workers.dev/)";
export const LINKS_PER_CALL = 20; // a HEAD and maybe a GET each, under the Workers subrequest limit

const doiOf = (url) => {
  const m = String(url).match(/^https?:\/\/(?:dx\.)?doi\.org\/(10\.\d{4,9}\/.+)$/i);
  return m ? decodeURIComponent(m[1]) : null;
};

async function one(url, fetchImpl) {
  const doi = doiOf(url);
  try {
    if (doi) {
      // The handle API answers for the DOI itself, whatever the publisher does.
      const res = await fetchImpl("https://doi.org/api/handles/" + encodeURI(doi), { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) });
      if (res.status === 404) return { url, ok: false, status: 404, reason: "這個 DOI 不存在" };
      const data = await res.json().catch(() => null);
      if (data?.responseCode === 100) return { url, ok: false, status: 404, reason: "這個 DOI 不存在" };
      return { url, ok: true, status: res.status };
    }
    const init = { redirect: "follow", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) };
    let res = await fetchImpl(url, { ...init, method: "HEAD" });
    if (res.status === 405 || res.status === 501) res = await fetchImpl(url, { ...init, method: "GET" });
    if (res.status === 404 || res.status === 410) return { url, ok: false, status: res.status, reason: "對方網站說找不到這一頁" };
    return { url, ok: true, status: res.status };
  } catch (e) {
    if (e?.name === "TimeoutError" || e?.name === "AbortError") return { url, ok: true, status: 0 };
    return { url, ok: false, status: 0, reason: "連不上這個網站" };
  }
}

export async function checkLinks(urls, fetchImpl = fetch) {
  const list = [...new Set((Array.isArray(urls) ? urls : []).map(String).filter((u) => /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(u)))].slice(0, LINKS_PER_CALL);
  const out = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const i = next++;
      out[i] = await one(list[i], fetchImpl);
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, list.length) }, worker));
  return out;
}
