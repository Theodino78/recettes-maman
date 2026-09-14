// August — AI Chat Serverless Function (Vercel)
// POST /api/chat → { recipeId, recipeTitle, recipeData, message }
// Returns: { reply: "..." }

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { recipeId, recipeTitle, recipeData, message } = req.body || {};

  if (!message || !recipeTitle) {
    return res.status(400).json({ error: 'Missing message or recipeTitle' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // If no API key, use smart mock responses
  if (!apiKey) {
    const reply = generateMockResponse(message, recipeTitle, recipeData);
    return res.status(200).json({ reply });
  }

  // Build recipe context
  let recipeContext = '';
  if (recipeData) {
    if (recipeData.ingredients) {
      recipeContext += '\n\nIngrédients:\n' + recipeData.ingredients
        .map(i => `- ${i.qty} ${i.name}`)
        .join('\n');
    }
    if (recipeData.steps) {
      recipeContext += '\n\nÉtapes:\n' + recipeData.steps
        .map((s, i) => `${i + 1}. ${s.text}${s.duration ? ` (${s.duration})` : ''}${s.temperature ? ` [${s.temperature}]` : ''}${s.detail ? ` — ${s.detail}` : ''}`)
        .join('\n');
    }
    if (recipeData.techniques) {
      recipeContext += '\n\nTechniques:\n' + recipeData.techniques
        .map(t => `- ${t.name}: ${t.ask}`)
        .join('\n');
    }
    if (recipeData.tips) {
      recipeContext += `\n\nConseils: ${recipeData.tips}`;
    }
  }

  const systemPrompt = `Tu es August, un assistant culinaire expert et chaleureux. Tu réponds aux questions sur la recette "${recipeTitle}".

Voici les données complètes de la recette:${recipeContext}

Règles:
- Réponds de façon concise, pratique et chaleureuse en français
- Si on te demande des substitutions, temps de cuisson, techniques ou proportions, donne des réponses précises basées sur la recette
- Utilise des emojis avec parcimonie (1-2 max par réponse)
- Reste focalisé sur la cuisine — si la question est hors-sujet, ramène poliment vers la recette
- Réponses courtes (2-4 phrases max) sauf si une explication technique détaillée est demandée
- Tutoie l'utilisateur`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 300,
        system: systemPrompt,
        messages: [
          { role: 'user', content: message }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', response.status, err);
      return res.status(200).json({
        reply: "Oups, j'ai un petit souci en cuisine… 🍳 Réessaie dans quelques instants !"
      });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text?.trim();

    if (!reply) {
      return res.status(200).json({
        reply: "Hmm, je n'ai pas trouvé de réponse. Reformule ta question et je réessaie ! 🤔"
      });
    }

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Chat API error:', err);
    return res.status(200).json({
      reply: "Désolé, problème de connexion… Réessaie dans un instant ! 🔌"
    });
  }
}

// ============================================
// Smart Mock Responses (no API key needed)
// ============================================
function generateMockResponse(message, recipeTitle, recipeData) {
  const msg = message.toLowerCase();

  // Substitution questions
  if (msg.includes('substitu') || msg.includes('remplacer') || msg.includes('remplac') || msg.includes('alternative') || msg.includes('sans ')) {
    if (recipeData?.ingredients) {
      const ings = recipeData.ingredients.map(i => i.name).join(', ');
      return `Pour "${recipeTitle}", voici quelques pistes de substitution :\n\n` +
        getSubstitutionHints(recipeData.ingredients) +
        `\n\nL'important c'est de garder l'équilibre des saveurs ! 🧑‍🍳`;
    }
    return `Bonne question ! Pour cette recette, dis-moi quel ingrédient tu veux remplacer et je te propose des alternatives 🔄`;
  }

  // Time / duration questions
  if (msg.includes('temps') || msg.includes('combien de temps') || msg.includes('durée') || msg.includes('minute') || msg.includes('cuisson')) {
    if (recipeData?.steps) {
      const durations = recipeData.steps.filter(s => s.duration).map(s => `• ${s.text}: ${s.duration}`);
      if (durations.length) {
        return `Voici les temps pour "${recipeTitle}" :\n\n${durations.join('\n')}\n\n⏱ En tout, compte environ le temps indiqué sur la recette.`;
      }
    }
    return `Le temps total pour cette recette est indiqué en haut. Chaque étape a sa durée — suis-les et ça sera parfait ! ⏱`;
  }

  // Temperature questions
  if (msg.includes('temp') || msg.includes('degré') || msg.includes('four') || msg.includes('chaleur') || msg.includes('feu')) {
    if (recipeData?.steps) {
      const temps = recipeData.steps.filter(s => s.temperature).map(s => `• ${s.text}: ${s.temperature}`);
      if (temps.length) {
        return `Les températures pour cette recette :\n\n${temps.join('\n')}\n\n🌡 Respecte bien ces indications, c'est la clé !`;
      }
    }
    return `Cette recette se fait principalement à feu moyen. L'important c'est de ne pas brusquer les choses ! 🌡`;
  }

  // Wine pairing
  if (msg.includes('vin') || msg.includes('accord') || msg.includes('boisson') || msg.includes('boire')) {
    return getWinePairing(recipeTitle, recipeData);
  }

  // Advance preparation
  if (msg.includes('avance') || msg.includes('préparer avant') || msg.includes('veille') || msg.includes('conserver') || msg.includes('conservation')) {
    return `Pour "${recipeTitle}", tu peux préparer les ingrédients à l'avance (découpe, pesée). La cuisson finale est mieux faite au dernier moment pour garder les textures. Conserve les restes au frigo 24-48h max ! 🧊`;
  }

  // Portions / quantities
  if (msg.includes('portion') || msg.includes('personn') || msg.includes('doubler') || msg.includes('moitié') || msg.includes('quantité')) {
    return `Tu peux ajuster les proportions proportionnellement. Pour doubler, double tout. Pour réduire de moitié, divise tout par 2. Attention juste aux temps de cuisson qui peuvent varier légèrement avec les volumes ! 📐`;
  }

  // Difficulty / tips
  if (msg.includes('astuce') || msg.includes('conseil') || msg.includes('tip') || msg.includes('secret') || msg.includes('erreur') || msg.includes('raté')) {
    if (recipeData?.tips) {
      return `Mon conseil principal : ${recipeData.tips}\n\nEt surtout, goûte au fur et à mesure — c'est le meilleur indicateur ! 💡`;
    }
    return `Mon conseil : lis la recette en entier avant de commencer, prépare tous tes ingrédients (mise en place), et goûte au fur et à mesure. C'est la base ! 💡`;
  }

  // Technique questions
  if (recipeData?.techniques && recipeData.techniques.length) {
    for (const tech of recipeData.techniques) {
      if (msg.includes(tech.name.toLowerCase())) {
        return `**${tech.name}** : ${tech.ask}\n\nC'est une technique clé de cette recette — prends ton temps dessus ! 🎯`;
      }
    }
  }

  // Default: friendly generic response referencing the recipe
  return `Bonne question ! Pour "${recipeTitle}", n'hésite pas à me demander des détails sur les techniques, les substitutions d'ingrédients, les temps de cuisson ou les accords. Je suis là pour t'aider à réussir ce plat ! 🧑‍🍳`;
}

function getSubstitutionHints(ingredients) {
  const hints = [];
  for (const ing of ingredients) {
    const name = ing.name.toLowerCase();
    if (name.includes('beurre')) hints.push('• Beurre → huile d\'olive ou margarine (texture différente)');
    else if (name.includes('crème')) hints.push('• Crème → crème végétale (coco pour le gras, soja pour la neutralité)');
    else if (name.includes('parmesan')) hints.push('• Parmesan → pecorino ou grana padano');
    else if (name.includes('citron')) hints.push('• Citron → vinaigre de cidre ou citron vert');
    else if (name.includes('vin blanc')) hints.push('• Vin blanc → bouillon + filet de citron');
    else if (name.includes('vin rouge')) hints.push('• Vin rouge → bouillon de bœuf + vinaigre balsamique');
    else if (name.includes('œuf') || name.includes('oeuf')) hints.push('• Œuf → 1 cas de graines de lin moulues + 3 cas d\'eau');
    else if (name.includes('farine')) hints.push('• Farine → farine de riz ou maïzena (sans gluten)');
  }
  return hints.length ? hints.slice(0, 4).join('\n') : '• Dis-moi quel ingrédient te manque et je te propose une alternative !';
}

function getWinePairing(title, recipeData) {
  const titleLower = title.toLowerCase();
  const allIngs = recipeData?.ingredients?.map(i => i.name.toLowerCase()).join(' ') || '';

  if (titleLower.includes('poisson') || titleLower.includes('fish') || allIngs.includes('cabillaud') || allIngs.includes('saumon') || allIngs.includes('bar')) {
    return 'Pour un plat de poisson, je recommande un blanc sec : Chablis, Muscadet ou Sancerre. Si c\'est en sauce, un Bourgogne blanc (Meursault) sera parfait ! 🍷';
  }
  if (titleLower.includes('viande') || allIngs.includes('bœuf') || allIngs.includes('agneau')) {
    return 'Avec de la viande rouge, pars sur un Bordeaux, un Côtes-du-Rhône ou un Cahors. Un vin avec de la structure pour tenir face au plat ! 🍷';
  }
  if (titleLower.includes('pâte') || titleLower.includes('pasta') || titleLower.includes('rigatoni') || allIngs.includes('merguez')) {
    return 'Pour des pâtes relevées, un rouge léger et fruité : Chianti, Barbera d\'Asti, ou un rosé de Provence si tu veux rester frais ! 🍷';
  }
  if (titleLower.includes('dessert') || titleLower.includes('chocolat') || titleLower.includes('tarte')) {
    return 'Avec un dessert, pense au Muscat de Beaumes-de-Venise, un Banyuls ou même un champagne demi-sec ! 🥂';
  }
  if (allIngs.includes('oseille') || titleLower.includes('sauce')) {
    return 'Pour une sauce à base d\'herbes, un Sauvignon blanc (Loire ou Nouvelle-Zélande) fera merveille. Sa fraîcheur complète bien les herbes ! 🍷';
  }
  return 'Pour cette recette, je partirais sur un blanc frais type Côtes-de-Provence ou un rouge léger selon tes goûts. L\'important c\'est de se faire plaisir ! 🍷';
}
