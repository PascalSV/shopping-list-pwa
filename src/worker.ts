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
        const body = await request.json() as { article_id: number | null; article_name?: string; remark?: string };
        
        let articleId = body.article_id;

        // If article_id is null, create a new article with the provided name
        if (articleId === null && body.article_name) {
          const insertResult = await env.DB.prepare(`
            INSERT INTO articles (name, area, frequency)
            VALUES (?, 0, 0)
          `).bind(body.article_name).run();
          
          articleId = insertResult.meta.last_row_id as number;
        }

        // Insert into shopping list
        await env.DB.prepare(`
          INSERT INTO shopping_list (article_id, remark)
          VALUES (?, ?)
        `).bind(articleId, body.remark || '').run();

        // Increment frequency
        await env.DB.prepare(`
          UPDATE articles 
          SET frequency = frequency + 1
          WHERE id = ?
        `).bind(articleId).run();

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

      // Update shopping list item
      if (url.pathname.startsWith('/api/shopping-list/') && request.method === 'PUT') {
        const id = url.pathname.split('/').pop();
        const body = await request.json() as { article_name: string; remark?: string };
        
        // First, get the current article_id and name
        const currentItem = await env.DB.prepare(`
          SELECT sl.article_id, a.name 
          FROM shopping_list sl
          JOIN articles a ON sl.article_id = a.id
          WHERE sl.id = ?
        `).bind(id).first() as { article_id: number; name: string } | null;

        if (!currentItem) {
          return new Response(JSON.stringify({ error: 'Item not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // If article name changed, update the article
        if (body.article_name !== currentItem.name) {
          await env.DB.prepare(`
            UPDATE articles 
            SET name = ?
            WHERE id = ?
          `).bind(body.article_name, currentItem.article_id).run();
        }

        // Update the remark in shopping_list
        await env.DB.prepare(`
          UPDATE shopping_list 
          SET remark = ?
          WHERE id = ?
        `).bind(body.remark || '', id).run();

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Delete article from articles list
      if (url.pathname.startsWith('/api/articles/') && request.method === 'DELETE') {
        const id = url.pathname.split('/').pop();
        
        // First delete from shopping_list (foreign key constraint)
        await env.DB.prepare(`
          DELETE FROM shopping_list WHERE article_id = ?
        `).bind(id).run();

        // Then delete from articles
        await env.DB.prepare(`
          DELETE FROM articles WHERE id = ?
        `).bind(id).run();

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Search articles
      if (url.pathname === '/api/articles/search' && request.method === 'GET') {
        const query = url.searchParams.get('q') || '';
        
        if (query.length < 1) {
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

      // Get frequent articles (top 4 by frequency)
      if (url.pathname === '/api/articles/frequent' && request.method === 'GET') {
        const result = await env.DB.prepare(`
          SELECT id, name, area, frequency
          FROM articles
          ORDER BY frequency DESC, name
          LIMIT 4
        `).all();

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
