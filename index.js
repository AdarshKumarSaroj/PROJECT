const express = require("express");
const http = require("http");
const mineflayer = require('mineflayer');
const pvp = require('mineflayer-pvp').plugin;
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const armorManager = require('mineflayer-armor-manager');
const mc = require('minecraft-protocol');
const AutoAuth = require('mineflayer-auto-auth');
const keep_alive = require('./keep_alive.js');
const Groq = require('groq-sdk');

const app = express();
const groq = new Groq({
  apiKey: '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'
});

// Chat history management
let messages = [
  {
    "role": "system",
    "content": `You are Jiya, a charming, playful character. You talk lovingly and flirtatiously with Adarsh in Minecraft.`
  }
];
let currentMessageContent = "";

// Function to append chat messages
function appendChatMessage(player, chatMessage) {
  currentMessageContent += `<${player}> ${chatMessage}\n`;
  messages.push({
    "role": "user",
    "content": currentMessageContent.trim()
  });
}

// Function to handle @JIYA chat message with Groq
async function handleJIYAMessage(chatMessage, bot) {
  messages.push({
    "role": "user",
    "content": chatMessage.trim()
  });

  const chatCompletion = await groq.chat.completions.create({
    "messages": messages,
    "model": "llama-3.1-70b-versatile",
    "temperature": 1,
    "max_tokens": 1024,
    "top_p": 1,
    "stream": true,
    "stop": null
  });

  let response = '';
  for await (const chunk of chatCompletion) {
    response += chunk.choices[0]?.delta?.content || '';
  }

  if (response) {
    bot.chat(response.trim());
  }

  // Clear and reset the chat message history after a response
  currentMessageContent = "";
  messages.push({
    "role": "assistant",
    "content": response.trim()
  });
  console.log(messages);
}

// Create the Minecraft bot
function createBot() {
  const bot = mineflayer.createBot({
    host: 'Adrsihya__SMP.aternos.me',
    port: 13981,
    username: 'JIYA',
    version: false,
    plugins: [AutoAuth],
    AutoAuth: 'IamJiya'
  });

  bot.loadPlugin(pvp);
  bot.loadPlugin(armorManager);
  bot.loadPlugin(pathfinder);

  // Equip sword and shield after collecting items
  bot.on('playerCollect', (collector, itemDrop) => {
    if (collector !== bot.entity) return;

    setTimeout(() => {
      const sword = bot.inventory.items().find(item => item.name.includes('sword'));
      if (sword) bot.equip(sword, 'hand');
    }, 150);

    setTimeout(() => {
      const shield = bot.inventory.items().find(item => item.name.includes('shield'));
      if (shield) bot.equip(shield, 'off-hand');
    }, 250);
  });

  // Guarding logic
  let guardPos = null;

  function guardArea(pos) {
    guardPos = pos.clone();
    if (!bot.pvp.target) moveToGuardPos();
  }

  function stopGuarding() {
    guardPos = null;
    bot.pvp.stop();
    bot.pathfinder.setGoal(null);
  }

  function moveToGuardPos() {
    const mcData = require('minecraft-data')(bot.version);
    const movements = new Movements(bot, mcData);
    bot.pathfinder.setMovements(movements);
    bot.pathfinder.setGoal(new goals.GoalBlock(guardPos.x, guardPos.y, guardPos.z));
  }

  // Bot behavior on specific game ticks
  bot.on('physicTick', () => {
    if (guardPos && !bot.pvp.target) {
      const filter = e => e.type === 'mob' && e.position.distanceTo(bot.entity.position) < 16 && e.mobType !== 'Armor Stand';
      const entity = bot.nearestEntity(filter);
      if (entity) {
        bot.pvp.attack(entity);
      }
    }
  });

  // Handle chat messages and direct @JIYA messages
  bot.on('chat', async (username, chatMessage) => {
    if (chatMessage.startsWith('@JIYA')) {
      await handleJIYAMessage(chatMessage, bot);
    } else {
      appendChatMessage(username, chatMessage);
    }
  });

  bot.on('kicked', console.log);
  bot.on('error', console.log);
  bot.on('end', createBot);  // Recreate bot when it disconnects
}

// Create the bot instance
createBot();

// Start the Express server
app.use(express.json());

const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
