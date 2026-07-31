/**
 * Cloudflare Worker — Notion proxy for the intern progress tracker.
 *
 * Keeps the Notion integration token secret on the server side. The static
 * site (hosted on GitHub Pages) calls this Worker instead of calling the
 * Notion API directly from the browser.
 *
 * Routes:
 *   GET  /items?user=CODE        -> list all rows for that user, sorted
 *   POST /items/:pageId          -> update one field on one row
 *        body: { "field": "done"|"text"|"link"|"script", "value": ... }
 *
 * Required environment variables / secrets (set in Cloudflare dashboard or via
 * `wrangler secret put` / wrangler.toml — see README.md for exact commands):
 *   NOTION_TOKEN        - secret. Notion internal integration token ("secret_...").
 *   NOTION_DATABASE_ID  - the database ID created for this project
 *                         (e34513ac1e744e6198c158b66b588153).
 *   ALLOWED_ORIGIN      - the origin of your GitHub Pages site, e.g.
 *                         "https://yourname.github.io". Used for CORS.
 */

const NOTION_VERSION = "2022-06-28";

const PROP = {
  title: "項目",
  category: "分類",
  user: "使用者",
  done: "完成",
  text: "填寫內容",
  link: "參考連結",
  script: "腳本內容",
  order: "順序"
};

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

function json(data, env, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) }
  });
}

function plainText(richTextArr) {
  if (!richTextArr || !richTextArr.length) return "";
  return richTextArr.map((t) => t.plain_text || "").join("");
}

// Notion rejects any single rich text object longer than 2000 characters, so
// long answers (reflections, Reels scripts) are split across several objects.
const RICH_TEXT_LIMIT = 2000;

function toRichText(value) {
  const s = value == null ? "" : String(value);
  const parts = [];
  for (let i = 0; i < s.length; i += RICH_TEXT_LIMIT) {
    parts.push({ text: { content: s.slice(i, i + RICH_TEXT_LIMIT) } });
  }
  return parts;
}

function pageToItem(page) {
  const p = page.properties || {};
  return {
    id: page.id,
    category: p[PROP.category] && p[PROP.category].select ? p[PROP.category].select.name : "",
    title: p[PROP.title] && p[PROP.title].title ? plainText(p[PROP.title].title) : "",
    done: !!(p[PROP.done] && p[PROP.done].checkbox),
    text: p[PROP.text] ? plainText(p[PROP.text].rich_text) : "",
    link: p[PROP.link] ? p[PROP.link].url || "" : "",
    script: p[PROP.script] ? plainText(p[PROP.script].rich_text) : "",
    order: p[PROP.order] ? p[PROP.order].number : 0
  };
}

async function notionFetch(env, path, options) {
  const res = await fetch("https://api.notion.com/v1" + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + env.NOTION_TOKEN,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(options && options.headers ? options.headers : {})
    }
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error("Notion API error " + res.status + ": " + JSON.stringify(body));
  }
  return body;
}

async function listItems(env, user) {
  let results = [];
  let cursor = undefined;
  do {
    const body = await notionFetch(env, "/databases/" + env.NOTION_DATABASE_ID + "/query", {
      method: "POST",
      body: JSON.stringify({
        filter: { property: PROP.user, select: { equals: user } },
        start_cursor: cursor,
        page_size: 100
      })
    });
    results = results.concat(body.results);
    cursor = body.has_more ? body.next_cursor : undefined;
  } while (cursor);

  return results.map(pageToItem).sort((a, b) => a.order - b.order);
}

async function updateItem(env, pageId, field, value) {
  let properties;
  switch (field) {
    case "done":
      properties = { [PROP.done]: { checkbox: !!value } };
      break;
    case "text":
      properties = { [PROP.text]: { rich_text: toRichText(value) } };
      break;
    case "link":
      properties = { [PROP.link]: { url: value ? String(value) : null } };
      break;
    case "script":
      properties = { [PROP.script]: { rich_text: toRichText(value) } };
      break;
    default:
      throw new Error("Unknown field: " + field);
  }
  await notionFetch(env, "/pages/" + pageId, {
    method: "PATCH",
    body: JSON.stringify({ properties })
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }

    try {
      if (request.method === "GET" && url.pathname === "/items") {
        const user = url.searchParams.get("user");
        if (!user) return json({ error: "missing ?user=" }, env, 400);
        const items = await listItems(env, user);
        return json({ items }, env);
      }

      if (request.method === "POST" && url.pathname.startsWith("/items/")) {
        const pageId = url.pathname.replace("/items/", "");
        const body = await request.json();
        if (!body || !body.field) return json({ error: "missing field" }, env, 400);
        await updateItem(env, pageId, body.field, body.value);
        return json({ ok: true }, env);
      }

      return json({ error: "not found" }, env, 404);
    } catch (err) {
      return json({ error: String((err && err.message) || err) }, env, 500);
    }
  }
};
