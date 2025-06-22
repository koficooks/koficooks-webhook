api/soundee-webhook.js
export default async function handler(req, res) {
  // Enable CORS for Soundee
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🎵 Soundee webhook received:', JSON.stringify(req.body, null, 2));
    
    const saleData = req.body;
    
    // Send to Facebook Conversions API
    const facebookResult = await sendToFacebookCAPI(saleData, req);
    
    console.log('✅ Facebook API success:', facebookResult);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Beat sale tracked successfully!',
      facebook_events_sent: facebookResult.events_received || 1,
      pixel_id: '104080037200303'
    });
    
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(500).json({ 
      error: 'Webhook processing failed', 
      details: error.message 
    });
  }
}

async function sendToFacebookCAPI(saleData, req) {
  const pixelId = process.env.FACEBOOK_PIXEL_ID || '104080037200303';
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN || 'EAATQhO4Sf7ABOx5nRnckFq0ddjANzaffgU8YhkOZA1oICH5RXu1gZC8oNPfksgTSPzAmoVtP6dVllVd8gztWerV3XZBgtkaIW196d4rm5ZCPVodittPK7rA1vSr9UAoIKOkgnYYuUe9IHWWuCQJZCamoJLz0RriLZCjroYMJ2kmVT4SxfE1HVTMZBi8dULvQAZDZD';
  
  // Map Soundee sale data to Facebook Conversions API format
  const eventData = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_source_url: 'https://koficooks.com',
      event_id: saleData.id || saleData.transaction_id || saleData.order_id || `sale_${Date.now( )}`,
      user_data: {
        // Hash customer email if provided
        em: saleData.customer_email || saleData.email ? 
            [hashSHA256(saleData.customer_email || saleData.email)] : undefined,
        // Hash customer phone if provided  
        ph: saleData.customer_phone || saleData.phone ? 
            [hashSHA256(saleData.customer_phone || saleData.phone)] : undefined,
        // Hash customer name if provided
        fn: saleData.customer_first_name || saleData.first_name ? 
            [hashSHA256(saleData.customer_first_name || saleData.first_name)] : undefined,
        ln: saleData.customer_last_name || saleData.last_name ? 
            [hashSHA256(saleData.customer_last_name || saleData.last_name)] : undefined,
        // IP and User Agent for better matching
        client_ip_address: saleData.ip_address || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        client_user_agent: saleData.user_agent || req.headers['user-agent']
      },
      custom_data: {
        // Purchase value and currency
        value: parseFloat(saleData.amount || saleData.total || saleData.price || 0),
        currency: saleData.currency || 'USD',
        content_type: 'product',
        content_category: 'beats',
        // Beat/product information
        content_ids: [saleData.product_id || saleData.beat_id || saleData.item_id || 'unknown_beat'],
        content_name: saleData.product_name || saleData.beat_name || saleData.title || 'Beat Purchase'
      }
    }]
  };

  // Remove undefined values to clean up the payload
  const userData = eventData.data[0].user_data;
  Object.keys(userData).forEach(key => {
    if (userData[key] === undefined) {
      delete userData[key];
    }
  });

  console.log('📤 Sending to Facebook:', JSON.stringify(eventData, null, 2));

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${pixelId}/events`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventData )
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Facebook API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// SHA256 hashing function for customer data
function hashSHA256(data) {
  if (!data) return null;
  
  const crypto = require('crypto');
  return crypto
    .createHash('sha256')
    .update(data.toString().toLowerCase().trim())
    .digest('hex');
}
