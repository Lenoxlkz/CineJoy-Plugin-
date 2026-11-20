// src/index.js
var TMDB_API_KEY = "8476a7ab80ad76f0936744df0430e67c";
var TMDB_BASE_URL = "https://api.themoviedb.org/3";
var TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
var TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280";
function getLang() {
  if (typeof kino !== "undefined" && kino.lang === "en-US") {
    return "en-US";
  }
  return "es-MX";
}
async function tmdbFetch(endpoint, queryParams = {}) {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());
  const params = new URLSearchParams({
    api_key: TMDB_API_KEY,
    language: getLang(),
    include_adult: "false",
    ...queryParams
  });
  const url = `${TMDB_BASE_URL}${endpoint}?${params.toString()}`;
  const fetchFn = typeof kino !== "undefined" && kino.fetch ? kino.fetch : globalThis.fetch;
  const res = await fetchFn(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "CineJoy-Kino-Plugin/1.0"
    }
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw typeof kino !== "undefined" && kino.error ? kino.error("unavailable", `Error TMDB ${res.status}`, { userMessage: "No pudimos conectar con el cat\xE1logo de Cinejoy" }) : new Error(`TMDB error ${res.status}`);
  }
  return await res.json();
}
function formatKinoItem(item, forcedKind) {
  const isMovie = forcedKind ? forcedKind === "movie" : item.media_type === "movie" || !!item.title;
  const title = item.title || item.name || item.original_title || item.original_name || "Sin t\xEDtulo";
  const dateStr = item.release_date || item.first_air_date || "";
  const year = dateStr ? parseInt(dateStr.slice(0, 4), 10) : void 0;
  const id = item.id;
  const kind = isMovie ? "movie" : "series";
  const ref = `${kind}:${id}`;
  const poster = item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : void 0;
  const backdrop = item.backdrop_path ? `${TMDB_BACKDROP_BASE}${item.backdrop_path}` : void 0;
  const genres = [kind === "movie" ? "peliculas" : "series"];
  if (item.genre_ids && Array.isArray(item.genre_ids)) {
    if (item.genre_ids.includes(28) || item.genre_ids.includes(10759)) genres.push("accion");
    if (item.genre_ids.includes(35)) genres.push("comedia");
    if (item.genre_ids.includes(18)) genres.push("drama");
    if (item.genre_ids.includes(27) || item.genre_ids.includes(9648)) genres.push("terror");
    if (item.genre_ids.includes(878) || item.genre_ids.includes(10765)) genres.push("ciencia-ficcion");
    if (item.genre_ids.includes(16)) genres.push("animacion");
  }
  return {
    id: `${kind}_${id}`,
    title,
    ref,
    kind,
    year,
    poster,
    backdrop,
    overview: item.overview || "",
    rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : void 0,
    genres,
    ids: { tmdb: id }
  };
}
async function home() {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());
  const [trending, popularMovies, popularSeries, action, horror, scifi] = await Promise.all([
    tmdbFetch("/trending/all/week"),
    tmdbFetch("/movie/popular"),
    tmdbFetch("/tv/popular"),
    tmdbFetch("/discover/movie", { with_genres: "28", sort_by: "popularity.desc" }),
    tmdbFetch("/discover/movie", { with_genres: "27", sort_by: "popularity.desc" }),
    tmdbFetch("/discover/movie", { with_genres: "878", sort_by: "popularity.desc" })
  ]);
  const rows = [];
  if (trending?.results?.length) {
    rows.push({
      id: "trending",
      title: "CineJoy: Tendencias y Estrenos",
      genre: "estrenos",
      items: trending.results.slice(0, 20).map((i) => formatKinoItem(i))
    });
  }
  if (popularMovies?.results?.length) {
    rows.push({
      id: "popular_movies",
      title: "Pel\xEDculas m\xE1s vistas",
      genre: "peliculas",
      items: popularMovies.results.slice(0, 20).map((i) => formatKinoItem(i, "movie"))
    });
  }
  if (popularSeries?.results?.length) {
    rows.push({
      id: "popular_series",
      title: "Series aclamadas",
      genre: "series",
      items: popularSeries.results.slice(0, 20).map((i) => formatKinoItem(i, "series"))
    });
  }
  if (action?.results?.length) {
    rows.push({
      id: "action_movies",
      title: "Acci\xF3n y Aventura",
      genre: "accion",
      items: action.results.slice(0, 20).map((i) => formatKinoItem(i, "movie"))
    });
  }
  if (horror?.results?.length) {
    rows.push({
      id: "horror_movies",
      title: "Terror y Misterio",
      genre: "terror",
      items: horror.results.slice(0, 20).map((i) => formatKinoItem(i, "movie"))
    });
  }
  if (scifi?.results?.length) {
    rows.push({
      id: "scifi_movies",
      title: "Ciencia Ficci\xF3n y Fantas\xEDa",
      genre: "ciencia-ficcion",
      items: scifi.results.slice(0, 20).map((i) => formatKinoItem(i, "movie"))
    });
  }
  return rows;
}
async function search(arg) {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());
  const q = typeof arg === "string" ? arg : arg?.q || arg?.query || "";
  if (!q || !q.trim()) return [];
  const data = await tmdbFetch("/search/multi", { query: q.trim() });
  if (!data?.results) return [];
  return data.results.filter((i) => (i.media_type === "movie" || i.media_type === "tv") && (i.poster_path || i.backdrop_path)).slice(0, 40).map((i) => formatKinoItem(i));
}
async function episodes(arg) {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());
  const ref = typeof arg === "string" ? arg : arg?.ref || "";
  if (!ref || !ref.startsWith("tv:") && !ref.startsWith("series:")) {
    return { episodes: [] };
  }
  const parts = ref.split(":");
  const tvId = parts[1];
  const seriesData = await tmdbFetch(`/tv/${tvId}`);
  if (!seriesData || !seriesData.seasons) return { episodes: [] };
  const regularSeasons = seriesData.seasons.filter((s) => s.season_number > 0);
  const targetSeasonNum = parts[2] ? parseInt(parts[2], 10) : regularSeasons[0]?.season_number || 1;
  const seasonData = await tmdbFetch(`/tv/${tvId}/season/${targetSeasonNum}`);
  if (!seasonData?.episodes) return { episodes: [] };
  const eps = seasonData.episodes.map((ep) => ({
    title: ep.name ? `${ep.episode_number}. ${ep.name}` : `Cap\xEDtulo ${ep.episode_number}`,
    ref: `tv:${tvId}:${targetSeasonNum}:${ep.episode_number}`,
    season: targetSeasonNum,
    number: ep.episode_number,
    overview: ep.overview || "",
    airDate: ep.air_date || "",
    still: ep.still_path ? `${TMDB_IMAGE_BASE}${ep.still_path}` : void 0
  }));
  const seasonsList = regularSeasons.map((s) => ({
    id: `season_${s.season_number}`,
    number: s.season_number,
    title: s.name || `Temporada ${s.season_number}`,
    ref: `tv:${tvId}:${s.season_number}`
  }));
  return {
    episodes: eps,
    seasons: seasonsList
  };
}
const WING_SERVERS_URL = "https://api2.wing.st/servers";
const WING_GATE_URL = "https://api2.wing.st/g";
const WING_PROTOCOL = "lumen-gate-v2";
const WING_SERVER_PUB_HEX = "045c88a0ae33c683a4872590b04b22f4774a4fe1c6ecf74785c74a919a71207ca94f9e6b5a7854c3aa3b44ee46bc444fea694b9f23bcd80f864ecbef48c1ef6e14";
const WING_SERVER_PRIORITY = ["Light", "Sirius", "Paris", "Polaris", "Rigel", "Munich", "Warsaw", "Nebula"];
const CINEJOY_REFERER = "https://cinejoy.pk/";
const CINEJOY_ORIGIN = "https://cinejoy.pk";
const WING_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function toZeroPaddedHex(n) {
  return n.toString(16).padStart(2, "0");
}

function getPublicRawHex(publicKey) {
  if (publicKey?.raw) {
    return kino.crypto.convert(publicKey.raw, "base64", "hex");
  }
  if (publicKey?.jwk?.x && publicKey?.jwk?.y) {
    const xHex = kino.crypto.convert(publicKey.jwk.x, "base64", "hex");
    const yHex = kino.crypto.convert(publicKey.jwk.y, "base64", "hex");
    return "04" + xHex + yHex;
  }
  throw new Error("Missing ephemeral EC public key");
}

async function queryWingGate(fetchFn, serverPubKey, path, payload) {
  const kp = kino.crypto.generateKeyPair({ type: "ec", namedCurve: "P-256" });
  const ephPubHex = getPublicRawHex(kp.publicKey);
  const sharedHex = kino.crypto.deriveSharedSecret({
    privateKey: kp.privateKey,
    publicKey: serverPubKey,
    outputEncoding: "hex"
  });

  const prkHex = kino.crypto.hmac("sha256", ephPubHex, sharedHex, {
    keyEncoding: "hex",
    inputEncoding: "hex",
    outputEncoding: "hex"
  });

  const c2sInfoHex = kino.crypto.convert(`${WING_PROTOCOL}|c2s`, "utf8", "hex") + "01";
  const s2cInfoHex = kino.crypto.convert(`${WING_PROTOCOL}|s2c`, "utf8", "hex") + "01";
  const reqKeyHex = kino.crypto.hmac("sha256", prkHex, c2sInfoHex, {
    keyEncoding: "hex",
    inputEncoding: "hex",
    outputEncoding: "hex"
  });
  const resKeyHex = kino.crypto.hmac("sha256", prkHex, s2cInfoHex, {
    keyEncoding: "hex",
    inputEncoding: "hex",
    outputEncoding: "hex"
  });

  const ivHex = kino.crypto.randomBytes(12, "hex");
  const protoHex = kino.crypto.convert(WING_PROTOCOL, "utf8", "hex");
  const reqAadHex = protoHex + "000102" + ephPubHex;
  const ptJson = JSON.stringify({ path, payload });

  const ctAndTagHex = kino.crypto.encrypt("aes-256-gcm", {
    key: reqKeyHex,
    keyEncoding: "hex",
    iv: ivHex,
    ivEncoding: "hex",
    aad: reqAadHex,
    aadEncoding: "hex",
    data: ptJson,
    inputEncoding: "utf8",
    outputEncoding: "hex"
  });

  const wireHex = toZeroPaddedHex(2) + toZeroPaddedHex(2) + ephPubHex + ivHex + ctAndTagHex;
  const wireBase64 = kino.crypto.convert(wireHex, "hex", "base64");

  const res = await fetchFn(WING_GATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Origin": CINEJOY_ORIGIN,
      "Referer": CINEJOY_REFERER,
      "User-Agent": WING_UA
    },
    body: { base64: wireBase64 },
    timeoutMs: 8000
  });

  if (!res.ok) {
    return { ok: false, httpStatus: res.status };
  }

  const respB64 = typeof res.base64 === "function" ? await res.base64() : null;
  if (!respB64) {
    return { ok: false, httpStatus: res.status };
  }

  const respHex = kino.crypto.convert(respB64, "base64", "hex");
  if (respHex.length < 56) {
    return { ok: false, httpStatus: res.status };
  }

  const respIvHex = respHex.slice(0, 24);
  const respCtTagHex = respHex.slice(24);
  const resAadHex = protoHex + "000202" + ephPubHex;

  const decrypted = kino.crypto.decrypt("aes-256-gcm", {
    key: resKeyHex,
    keyEncoding: "hex",
    iv: respIvHex,
    ivEncoding: "hex",
    aad: resAadHex,
    aadEncoding: "hex",
    data: respCtTagHex,
    inputEncoding: "hex",
    outputEncoding: "utf8"
  });

  return { ok: true, httpStatus: res.status, json: JSON.parse(decrypted) };
}

async function resolve(arg, options = {}) {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());
  const ref = typeof arg === "string" ? arg : arg?.ref || "";
  if (!ref) {
    throw typeof kino !== "undefined" && kino.error ? kino.error("not_found", "Referencia vac\xEDa", { userMessage: "No se encontr\xF3 el contenido solicitado" }) : new Error("Referencia vac\xEDa");
  }
  const parts = ref.split(":");
  const kind = parts[0];
  const id = parts[1];
  const season = parts[2] || "1";
  const episode = parts[3] || "1";
  const isMovie = kind === "movie";
  let mediaTitle = "CineJoy Media";
  let rawTitle = "";
  let yearStr = "";
  let imdbId = null;
  try {
    const details = await tmdbFetch(`/${isMovie ? "movie" : "tv"}/${id}`, {
      append_to_response: "external_ids"
    });
    if (details) {
      mediaTitle = details.title || details.name || "CineJoy Media";
      rawTitle = details.original_title || details.original_name || details.title || details.name || "";
      const dateStr = details.release_date || details.first_air_date || "";
      yearStr = dateStr ? dateStr.slice(0, 4) : "";
      if (!isMovie) {
        mediaTitle += ` - T${season}:E${episode}`;
      }
      imdbId = details.external_ids?.imdb_id || details.imdb_id || null;
    }
  } catch (e) {
  }

  const fetchFn = typeof kino !== "undefined" && kino.fetch ? kino.fetch : globalThis.fetch;
  let streams = [];
  const collectedSubtitles = [];
  const seenUrls = /* @__PURE__ */ new Set();
  const seenSubs = /* @__PURE__ */ new Set();
  let resolverHasNoSource = false;

  const parseDirectStream = (entry) => {
    const item = typeof entry === "string" ? { url: entry } : entry;
    if (!item || typeof item !== "object") return null;
    const url = item.url || item.playlist || item.stream_url || item.src || item.file || item.master_m3u8;
    if (typeof url !== "string") return null;
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return null;
    }
    if (parsed.protocol !== "https:" || !parsed.hostname) return null;
    const declaredMime = String(item.mime || item.mime_type || item.content_type || item.type || "").toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const isHls = path.endsWith(".m3u8") || declaredMime === "hls" || declaredMime.includes("mpegurl") || declaredMime.includes("vnd.apple.mpegurl");
    const isMp4 = !isHls && (path.endsWith(".mp4") || declaredMime.startsWith("video/mp4"));
    if (!isHls && !isMp4) return null;
    return {
      url,
      // Kino only accepts an explicit `mime` for video/mp4. For HLS, omit it so Kino
      // identifies the playlist from its URL and content (per the Stream contract).
      ...isMp4 ? { mime: "video/mp4" } : {},
      label: typeof item.label === "string" ? item.label : typeof item.server === "string" ? item.server : void 0,
      headers: item.headers && typeof item.headers === "object" && !Array.isArray(item.headers) ? item.headers : {}
    };
  };

  const resolverLog = (...args) => {
    if (typeof kino !== "undefined" && typeof kino.log === "function") kino.log(...args);
  };

  // Resolver directo de CineJoy (api2.wing.st lumen-gate-v2)
  if (typeof kino !== "undefined" && kino.crypto && typeof kino.crypto.generateKeyPair === "function") {
    let availableServers = [];
    try {
      const srvRes = await fetchFn(WING_SERVERS_URL, {
        headers: {
          "Accept": "application/json",
          "Origin": CINEJOY_ORIGIN,
          "Referer": CINEJOY_REFERER,
          "User-Agent": WING_UA
        },
        timeoutMs: 4000
      });
      if (srvRes.ok) {
        const srvJson = await srvRes.json();
        const rawList = Array.isArray(srvJson) ? srvJson : srvJson?.servers;
        if (Array.isArray(rawList)) {
          availableServers = rawList
            .filter((s) => s && s.status === "ok" && typeof s.name === "string" && s.name)
            .map((s) => s.name);
        }
      }
    } catch (_) {
    }

    if (!availableServers.length) {
      availableServers = [...WING_SERVER_PRIORITY];
    }

    const orderedServers = [
      ...WING_SERVER_PRIORITY.filter((name) => availableServers.includes(name)),
      ...availableServers.filter((name) => !WING_SERVER_PRIORITY.includes(name))
    ].filter((name) => isMovie || name !== "Paris");

    const preferredServer = String(
      options?.server || (typeof kino !== "undefined" ? kino?.settings?.server : "") || "auto"
    ).trim();
    if (preferredServer && preferredServer.toLowerCase() !== "auto") {
      const matchIdx = orderedServers.findIndex((n) => n.toLowerCase() === preferredServer.toLowerCase());
      if (matchIdx > 0) {
        const [chosen] = orderedServers.splice(matchIdx, 1);
        orderedServers.unshift(chosen);
      }
    }

    const wingPayload = isMovie
      ? {
          tmdb: String(id),
          ...(imdbId ? { imdb: imdbId } : {}),
          ...(yearStr ? { year: yearStr } : {}),
          ...(rawTitle ? { title: rawTitle } : {})
        }
      : {
          tmdb: String(id),
          season: String(season),
          episode: String(episode),
          ...(imdbId ? { imdb: imdbId } : {}),
          ...(yearStr ? { year: yearStr } : {}),
          ...(rawTitle ? { title: rawTitle } : {})
        };

    const wingPathSuffix = isMovie ? "movie" : "series";

    try {
      const serverPubKey = kino.crypto.importKey({
        format: "raw",
        type: "ec",
        namedCurve: "P-256",
        key: kino.crypto.convert(WING_SERVER_PUB_HEX, "hex", "base64")
      });

      let server404Count = 0;
      let serverErrorCount = 0;

      const queryBatch = async (batchNames) => {
        const results = await Promise.allSettled(
          batchNames.map(async (srvName) => {
            const ans = await queryWingGate(fetchFn, serverPubKey, `/${srvName}/${wingPathSuffix}`, wingPayload);
            return { srvName, ans };
          })
        );

        for (const r of results) {
          if (r.status !== "fulfilled") {
            serverErrorCount++;
            continue;
          }
          const { srvName, ans } = r.value;
          if (!ans?.ok) {
            serverErrorCount++;
            continue;
          }
          const apiStatus = Number(ans.json?.status ?? ans.json?.data?.status ?? 0);
          const list = ans.json?.data?.stream;
          if (apiStatus === 404 || ans.json?.data?.error === "Not Found") {
            server404Count++;
            continue;
          }
          if (Array.isArray(list) && list.length > 0) {
            for (const entry of list) {
              const streamUrl = entry?.playlist || entry?.url;
              const parsed = parseDirectStream({
                url: streamUrl,
                type: entry?.type || "hls",
                server: `CineJoy · ${srvName}`,
                headers: {
                  "Referer": CINEJOY_REFERER,
                  "Origin": CINEJOY_ORIGIN
                }
              });
              if (parsed && !seenUrls.has(parsed.url)) {
                seenUrls.add(parsed.url);
                streams.push(parsed);
              }
              if (Array.isArray(entry?.captions)) {
                for (const cap of entry.captions) {
                  if (cap && typeof cap.url === "string" && cap.url.startsWith("https://") && !seenSubs.has(cap.url)) {
                    seenSubs.add(cap.url);
                    const capLang = String(cap.id || cap.language || "und").slice(0, 16).toLowerCase();
                    const capFmt = String(cap.type || "").toLowerCase() === "srt" ? "srt" : "vtt";
                    collectedSubtitles.push({
                      lang: capLang || "und",
                      url: cap.url,
                      format: capFmt
                    });
                  }
                }
              }
            }
          } else if (apiStatus >= 500) {
            serverErrorCount++;
          }
        }
      };

      const firstBatch = orderedServers.slice(0, 4);
      const secondBatch = orderedServers.slice(4, 8);
      if (firstBatch.length > 0) {
        await queryBatch(firstBatch);
      }
      if (streams.length < 2 && secondBatch.length > 0) {
        await queryBatch(secondBatch);
      }

      if (!streams.length && server404Count > 0 && serverErrorCount === 0) {
        resolverHasNoSource = true;
      }
      resolverLog(`CineJoy resolver: servers=${orderedServers.length}; direct=${streams.length}; not_found=${server404Count}; errors=${serverErrorCount}`);
    } catch (gateErr) {
      resolverLog(`CineJoy resolver: error=${gateErr?.message || "gate_failed"}; direct=0`);
    }
  } else {
    resolverLog("CineJoy resolver: skipped; reason=no_kino_crypto");
  }

  // Integraci\xF3n con scrapers de Nuvio (Kino 0.9.71+, apiVersion 11+)
  const NUVIO_REPO = "NuvioPlugin/All-in-One-Nuvio";
  const MAX_NUVIO_SCRAPERS = 5;
  if (typeof kino !== "undefined" && typeof kino.nuvio === "object") {
    try {
      const offered = await kino.nuvio.available({ repo: NUVIO_REPO });
      if (Array.isArray(offered) && offered.length > 0) {
        let remembered = [];
        try {
          if (typeof kino.storage === "object" && typeof kino.storage.get === "function") {
            remembered = (await kino.storage.get("nuvio_fast_scrapers")) || [];
          }
        } catch (_) {}

        const reqType = isMovie ? "movie" : "tv";
        const compatible = offered.filter((o) => o.compatible !== false && Array.isArray(o.types) && o.types.includes(reqType));

        compatible.sort((a, b) => {
          const aRem = remembered.indexOf(a.id) !== -1 ? 1 : 0;
          const bRem = remembered.indexOf(b.id) !== -1 ? 1 : 0;
          if (aRem !== bRem) return bRem - aRem;
          const aEs = Array.isArray(a.languages) && a.languages.includes("es") ? 1 : 0;
          const bEs = Array.isArray(b.languages) && b.languages.includes("es") ? 1 : 0;
          return bEs - aEs;
        });

        const scraperIds = compatible.slice(0, MAX_NUVIO_SCRAPERS).map((o) => o.id);
        if (scraperIds.length > 0) {
          await kino.nuvio.use({ repo: NUVIO_REPO, scrapers: scraperIds });

          const nuvioQuery = {
            repo: NUVIO_REPO,
            type: reqType,
            tmdbId: parseInt(id, 10),
            scrapers: scraperIds,
            timeoutMs: 15000
          };
          if (!isMovie) {
            nuvioQuery.season = parseInt(season, 10) || 1;
            nuvioQuery.episode = parseInt(episode, 10) || 1;
          }

          const ans = await kino.nuvio.streams(nuvioQuery);
          const successfulScrapers = [];
          if (ans && Array.isArray(ans.results)) {
            for (const res of ans.results) {
              if (!res.ok || !res.stream) continue;
              successfulScrapers.push(res.scraper.id);
              const allCopies = [res.stream].concat(res.stream.alternatives || []);
              for (const c of allCopies) {
                const parsed = parseDirectStream(c);
                if (parsed && !seenUrls.has(parsed.url)) {
                  seenUrls.add(parsed.url);
                  parsed.label = res.scraper.name + (parsed.label ? " \xB7 " + parsed.label : "");
                  streams.push(parsed);
                }
              }
            }
          }

          if (successfulScrapers.length > 0 && typeof kino.storage === "object" && typeof kino.storage.set === "function") {
            const updated = Array.from(new Set([...successfulScrapers, ...remembered])).slice(0, 10);
            try { await kino.storage.set("nuvio_fast_scrapers", updated); } catch (_) {}
          }
        }
      }
    } catch (nuvioErr) {
      resolverLog("CineJoy Nuvio resolver: " + (nuvioErr?.message || nuvioErr));
    }
  }

  if (!streams.length) {
    const errorCode = resolverHasNoSource ? "not_found" : "unavailable";
    const detail = resolverHasNoSource ? "CineJoy no tiene fuente para este t\xEDtulo" : "Servidores de video no disponibles";
    const userMessage = resolverHasNoSource ? "CineJoy no tiene una fuente disponible para este t\xEDtulo." : "Los servidores de video no est\xE1n disponibles en este momento. Intenta m\xE1s tarde.";
    throw typeof kino !== "undefined" && kino.error ? kino.error(errorCode, detail, { userMessage }) : Object.assign(new Error(detail), { code: errorCode });
  }

  const streamHeaders = {
    "User-Agent": WING_UA
  };
  const PROXY_BASE = "https://cinejoyproxy.lenoxlkzsdy.workers.dev";
  const proxyEnabled = options?.hls_proxy !== false && (typeof kino === "undefined" || kino?.settings?.hls_proxy !== false);
  const PROXY_HOSTS = [
    "lightspeed.st",
    "ferb.st",
    "vrodaz.com",
    "cursed.st",
    "ttcdn-us.com",
    "bright67.online",
    "remoteconsultinggroup",
    "highperformancebrands",
    "vaplayer",
    "brightpathsignals"
  ];
  const shouldProxy = (urlStr) => {
    if (!proxyEnabled || !urlStr || typeof urlStr !== "string") return false;
    try {
      const h = new URL(urlStr).hostname.toLowerCase();
      return PROXY_HOSTS.some((pattern) => h === pattern || h.endsWith("." + pattern) || h.includes(pattern));
    } catch (e) {
      return false;
    }
  };
  const wrapUrl = (urlStr, customReferer, pathHint = "playlist.m3u8") => {
    if (!shouldProxy(urlStr)) return urlStr;
    const refParam = customReferer ? `&ref=${encodeURIComponent(customReferer)}` : "";
    return `${PROXY_BASE}/${pathHint}?url=${encodeURIComponent(urlStr)}${refParam}`;
  };

  const primary = streams[0];
  const hasResolverHeaders = streams.some((stream) => Object.keys(stream.headers).length > 0);
  const alternatives = streams.slice(1, 9).map((stream, idx) => {
    const refHdr = stream.headers?.Referer || stream.headers?.referer || "";
    const proxied = shouldProxy(stream.url);
    return {
      url: wrapUrl(stream.url, refHdr, stream.mime === "video/mp4" ? "seg.mp4" : "playlist.m3u8"),
      ...stream.mime ? { mime: stream.mime } : {},
      label: stream.label || `Servidor alternativo ${idx + 1}`,
      headers: proxied ? { ...streamHeaders } : { ...streamHeaders, ...stream.headers }
    };
  });

  const subPref = String(options?.lang || (typeof kino !== "undefined" ? kino?.settings?.lang : "") || "es").toLowerCase();
  const formattedSubtitles = subPref === "none"
    ? []
    : collectedSubtitles
        .map((sub) => ({
          lang: sub.lang,
          url: wrapUrl(sub.url, CINEJOY_REFERER, sub.format === "srt" ? "sub.srt" : "sub.vtt"),
          format: sub.format
        }))
        .sort((a, b) => {
          const aMatch = a.lang.startsWith(subPref) ? 1 : 0;
          const bMatch = b.lang.startsWith(subPref) ? 1 : 0;
          return bMatch - aMatch;
        })
        .slice(0, 12);

  if (typeof kino !== "undefined" && typeof kino.log === "function") {
    const hosts = [...new Set(streams.map((stream) => new URL(stream.url).hostname))];
    const headerNames = new Set(Object.keys(streamHeaders));
    for (const stream of streams) for (const name of Object.keys(stream.headers)) headerNames.add(name);
    const fallback = hasResolverHeaders ? "user-agent+resolver-headers" : "user-agent-only";
    kino.log(`CineJoy resolve: streams=${streams.length}; distinct_hosts=${hosts.length}; hosts=${hosts.join(",")}; headers=${[...headerNames].join(",")}; alternatives=${fallback}; proxied=${shouldProxy(primary.url)}`);
  }

  const primaryRef = primary.headers?.Referer || primary.headers?.referer || "";
  const primaryProxied = shouldProxy(primary.url);

  return {
    url: wrapUrl(primary.url, primaryRef, primary.mime === "video/mp4" ? "seg.mp4" : "playlist.m3u8"),
    ...primary.mime ? { mime: primary.mime } : {},
    label: primary.label || "Servidor principal (Ultra HD)",
    title: mediaTitle,
    headers: primaryProxied ? { ...streamHeaders } : { ...streamHeaders, ...primary.headers },
    alternatives,
    subtitles: formattedSubtitles
  };
}

const SOCIAL_REPO = "kinotvapp/kino-social";
const SHARE_SHEET = "shareSheet";

function renderShareSheet(share, inputs = {}) {
  return {
    type: "BottomSheet",
    key: SHARE_SHEET,
    title: "Compartir en Kino Social",
    children: [
      {
        type: "Form",
        key: "shareForm",
        onSubmitted: { event: "sendShare", timeoutMs: 15000 },
        gap: 12,
        children: [
          {
            type: "TextField",
            key: "shareText",
            multiline: true,
            maxLines: 5,
            maxLength: 500,
            value: inputs.shareText || "¡Disfrutando de películas y series en CineJoy!",
            labelText: "¿Qué quieres contar?"
          },
          ...(share ? [{
            type: "Switch",
            key: "shareTitle",
            value: inputs.shareTitle !== false,
            labelText: "Adjuntar el título"
          }] : []),
          {
            type: "Text",
            style: "caption",
            color: "muted",
            text: "Llega a Kino Social como borrador: allá lo revisas y lo publicas."
          },
          {
            type: "ElevatedButton",
            key: "shareSend",
            icon: "send",
            submit: true,
            labelText: "Enviar a Kino Social"
          }
        ]
      }
    ]
  };
}

async function screen(context = {}) {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());
  const currentTab = context?.state?.tab || context?.args?.tab || "trending";
  let items = [];
  if (currentTab === "movies") {
    const data = await tmdbFetch("/movie/popular");
    items = data?.results?.slice(0, 30).map((i) => formatKinoItem(i, "movie")) || [];
  } else if (currentTab === "series") {
    const data = await tmdbFetch("/tv/popular");
    items = data?.results?.slice(0, 30).map((i) => formatKinoItem(i, "series")) || [];
  } else if (currentTab === "action") {
    const data = await tmdbFetch("/discover/movie", { with_genres: "28" });
    items = data?.results?.slice(0, 30).map((i) => formatKinoItem(i, "movie")) || [];
  } else {
    const data = await tmdbFetch("/trending/all/day");
    items = data?.results?.slice(0, 30).map((i) => formatKinoItem(i)) || [];
  }
  return {
    type: "scaffold",
    appBar: {
      type: "appBar",
      title: "CineJoy",
      mergeWithKinoBar: true,
      dense: true,
      leading: {
        type: "button",
        variant: "icon",
        icon: "close",
        label: "Cerrar",
        onTap: {
          go: { close: true }
        }
      },
      actions: [
        {
          type: "button",
          variant: "icon",
          icon: "share",
          label: "Compartir",
          onTap: { event: "openShare", arg: "" }
        }
      ],
      bottom: {
        type: "tabs",
        tabs: [
          { label: "Tendencias", value: "trending" },
          { label: "Películas", value: "movies" },
          { label: "Series TV", value: "series" },
          { label: "Acción", value: "action" }
        ],
        value: currentTab,
        onChange: { event: "changeTab" }
      }
    },
    body: {
      type: "box",
      children: [
        {
          type: "titleGrid",
          items
        },
        renderShareSheet(context?.state?.share || null, context?.state?.inputs || {})
      ]
    }
  };
}

async function screenEvent(event) {
  await (typeof kino !== "undefined" && typeof kino.sleep === "function" ? kino.sleep(1) : Promise.resolve());
  const name = event?.name || (typeof event === "string" ? event : "");

  if (name === "changeTab") {
    const tab = event?.value || event?.arg || "trending";
    return {
      state: { tab }
    };
  }

  if (name === "openShare") {
    const defaultText = "¡Disfrutando de películas y series en CineJoy!";
    return {
      state: {
        share: { name: "CineJoy" },
        inputs: { shareText: defaultText, shareTitle: true }
      },
      ui: [{ open: SHARE_SHEET }]
    };
  }

  if (name === "sendShare") {
    const values = event?.value || event?.values || event?.state?.inputs || {};
    const text = String(values.shareText || "").trim().slice(0, 500);
    const withTitle = values.shareTitle !== false;
    const installed = event?.installed || {};

    if (!text && !withTitle) {
      return { toast: "Escribe algo o adjunta el título para compartir." };
    }

    if (typeof kino !== "undefined" && kino.plugins && typeof kino.plugins.call === "function") {
      const payload = { from: "CineJoy" };
      if (text) payload.text = text;
      if (withTitle) payload.title = { kind: "movie", tmdb: 550 };

      try {
        await kino.plugins.call("social", "share", payload);
        return {
          ui: [{ close: SHARE_SHEET }],
          state: { share: null },
          toast: "Listo: tienes el borrador en Kino Social para revisarlo y publicarlo."
        };
      } catch (e) {
        const code = e && e.code;
        if (code === "provider_missing" && installed[SOCIAL_REPO] !== true) {
          return {
            ui: [{ close: SHARE_SHEET }],
            go: { installPlugin: { repo: SOCIAL_REPO } },
            toast: "Instala Kino Social para compartir."
          };
        }
        if (code === "provider_missing") {
          return {
            toast: "Kino Social está apagado o le falta configurarse: revísalo en Plugins."
          };
        }
        if (code === "not_declared") {
          return {
            toast: "Actualiza Kino Social para compartir."
          };
        }
        return {
          toast: "No se pudo enviar a Kino Social. Inténtalo de nuevo."
        };
      }
    }
    return {
      toast: "Actualiza Kino para compartir en Kino Social."
    };
  }

  return {};
}

export {
  episodes,
  home,
  resolve,
  screen,
  screenEvent,
  search
};
