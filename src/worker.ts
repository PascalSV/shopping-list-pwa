interface Env {
  DB: D1Database;
  PASSWORD: string;
  ASSETS: Fetcher;
}

interface ShoppingListItem {
  id: number;
  article_id: number;
  remark: string;
  article_name: string;
  area: number;
}

interface Article {
  id: number;
  name: string;
  area: number;
  frequency: number;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // API Routes - handle these before static files
      if (url.pathname === '/api/login' && request.method === 'POST') {
        const body = await request.json() as { password: string };
        
        if (body.password === env.PASSWORD) {
          return new Response(JSON.stringify({ success: true, token: 'authenticated' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({ success: false, error: 'Invalid password' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // Get shopping list
      if (url.pathname === '/api/shopping-list' && request.method === 'GET') {
        const result = await env.DB.prepare(`
          SELECT 
            sl.id,
            sl.article_id,
            sl.remark,
            a.name as article_name,
            a.area
          FROM shopping_list sl
          JOIN articles a ON sl.article_id = a.id
          ORDER BY a.area, a.name
        `).all();

        return new Response(JSON.stringify(result.results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Add item to shopping list
      if (url.pathname === '/api/shopping-list' && request.method === 'POST') {
        const body = await request.json() as { article_id: number; remark?: string };
        
        // Insert into shopping list
        await env.DB.prepare(`
          INSERT INTO shopping_list (article_id, remark)
          VALUES (?, ?)
        `).bind(body.article_id, body.remark || '').run();

        // Increment frequency
        await env.DB.prepare(`
          UPDATE articles 
          SET frequency = frequency + 1
          WHERE id = ?
        `).bind(body.article_id).run();

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Remove item from shopping list
      if (url.pathname.startsWith('/api/shopping-list/') && request.method === 'DELETE') {
        const id = url.pathname.split('/').pop();
        
        await env.DB.prepare(`
          DELETE FROM shopping_list WHERE id = ?
        `).bind(id).run();

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Search articles
      if (url.pathname === '/api/articles/search' && request.method === 'GET') {
        const query = url.searchParams.get('q') || '';
        
        if (query.length < 3) {
          return new Response(JSON.stringify([]), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const result = await env.DB.prepare(`
          SELECT id, name, area, frequency
          FROM articles
          WHERE name LIKE ?
          ORDER BY frequency DESC, name
          LIMIT 20
        `).bind(`%${query}%`).all();

        return new Response(JSON.stringify(result.results), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // If no API route matched, serve static files from Assets
      return env.ASSETS.fetch(request);

    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
