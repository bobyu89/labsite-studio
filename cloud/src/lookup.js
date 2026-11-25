// DOI / PMID → reference metadata, fetched server-side (doi.org, Crossref,
// NCBI E-utilities). Only the identifier leaves LabSite; no user data is sent.
import { RepoError } from "./repo.js";
import { parseIdentifier, fromCsl, fromPubmed } from "../../src/site/cite.js";

const UA = "LabSite/1.0 (research-lab website editor)";

async function json(fetchImpl, url, what, accept = "application/json") {
  let res;
  try {
    res = await fetchImpl(url, { headers: { Accept: accept, "User-Agent": UA }, redirect: "follow" });
  } catch {
    throw new RepoError(502, `連不到 ${what}，請稍後再試。`);
  }
  if (res.status === 404 || res.status === 204) return null;
  if (!res.ok) throw new RepoError(502, `${what} 回應錯誤（${res.status}），請稍後再試。`);
  return res.json().catch(() => null);
}

// doi.org answers in CSL-JSON for every registration agency (Crossref,
// DataCite, 華藝 Airiti …); the Crossref API is the fallback.
async function byDoi(fetchImpl, doi) {
  const csl = await json(fetchImpl, "https://doi.org/" + encodeURI(doi), "doi.org", "application/vnd.citationstyles.csl+json").catch(() => null);
  if (csl?.title) return fromCsl(csl);
  const data = await json(fetchImpl, "https://api.crossref.org/works/" + encodeURIComponent(doi), "Crossref");
  return data?.message ? fromCsl(data.message) : null;
}

export async function lookupReference(input, fetchImpl = fetch) {
  const id = parseIdentifier(input);
  if (!id) throw new RepoError(400, "看不懂這個編號。請貼 DOI（例如 10.1111/jan.12345）或 PubMed 編號（PMID，例如 39889522）。");
  if (id.type === "doi") {
    const meta = await byDoi(fetchImpl, id.id);
    if (!meta) throw new RepoError(404, "找不到這個 DOI，請確認有沒有打錯。");
    return meta;
  }
  const data = await json(
    fetchImpl,
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&tool=labsite&id=${encodeURIComponent(id.id)}`,
    "PubMed",
  );
  const doc = data?.result?.[id.id];
  if (!doc || doc.error) throw new RepoError(404, "找不到這個 PubMed 編號，請確認有沒有打錯。");
  const meta = fromPubmed(doc, id.id);
  // Crossref has the journal's proper title and full given names; keep the PMID.
  if (meta.doi) {
    const better = await byDoi(fetchImpl, meta.doi).catch(() => null);
    if (better?.title && better.authors.length) return { ...better, pmid: meta.pmid };
  }
  return meta;
}
