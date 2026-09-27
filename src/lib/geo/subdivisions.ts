import SUBDIVISIONS from './subdivisions.json'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  STATE, PROVINCE AND REGION NAMES, for every country.
 *
 *  Vercel reports where a visitor is as a country code and an ISO 3166-2
 *  subdivision code (`x-vercel-ip-country-region`): "NG" and "LA" for Lagos, "BR"
 *  and "SP" for São Paulo, "GB" and "ENG" for England. The owner wants those names
 *  written in full, so the codes are looked up here.
 *
 *  The table is the ISO 3166-2 list from Debian's iso-codes 4.16.0 (LGPL-2.1 or
 *  later): 5,046 subdivisions in 200 countries, each under its official name, which
 *  for some places is the local one ("Bayern", "Île-de-France"). Server-side only;
 *  nothing here is sent to a browser.
 *
 *  To refresh it on a machine with the iso-codes package installed:
 *    python3 -c "import json,collections;o=collections.OrderedDict()
 *    [o.setdefault(s['code'].split('-',1)[0],{}).__setitem__(s['code'].split('-',1)[1],s['name'])
 *     for s in sorted(json.load(open('/usr/share/iso-codes/json/iso_3166-2.json'))['3166-2'],key=lambda s:s['code'])]
 *    json.dump(o,open('src/lib/geo/subdivisions.json','w'),ensure_ascii=False,separators=(',',':'))"
 * ─────────────────────────────────────────────────────────────────────────────
 */
const TABLE = SUBDIVISIONS as Readonly<Record<string, Readonly<Record<string, string>>>>

/** "NG", "LA" → "Lagos". Null when the code is not a known subdivision of that country. */
export function subdivisionName(country: string | null | undefined, code: string | null | undefined): string | null {
  if (!country || !code) return null
  return TABLE[country.trim().toUpperCase()]?.[code.trim().toUpperCase()] ?? null
}
