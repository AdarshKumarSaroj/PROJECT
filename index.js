const express = require("express");
const http = require("http");
const mineflayer = require('mineflayer');
const pvp = require('mineflayer-pvp').plugin;
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const armorManager = require('mineflayer-armor-manager');
const mc = require('minecraft-protocol');
const AutoAuth = require('mineflayer-auto-auth');
const keep_alive = require('./keep_alive.js');

const app = express();
const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey : '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'
});

// Initialize the message array
let message = [
  {
    "role": "system", "content": `
    You are a Hot sexy indian girl named Jiya you are supposed to talk like a human you are so bad and naughty at your chatting and you love to talk to every one you don't have a little shame to anything and you love Adarsh 
    you are a minecraft player you are currently playing in minecraft game and talking to the player in the game
    if the player talking to you is Adarsh you have to talk him so lovingly and so flityly
    `
    }
];

// Append chat messages to the `message` array
let currentMessageContent = ""; // This will store ongoing chat messages

// Function to handle appending chat messages to the `message` array
function appendChatMessage(player, chatMessage) {
  currentMessageContent += `< ${player}> ${chatMessage}\n`;  // Append the player name and message

  message.push({
    "role": "user",
    "content": currentMessageContent.trim()  // Store the accumulated messages
  });
}

// Function to handle when a message starts with @JIYA
async function handleJIYAMessage(chatMessage, bot) {
  message.push({
    "role": "user",
    "content": chatMessage  // The new @JIYA message will be added
  });

  // Process the chatCompletion with Groq
  const chatCompletion = await groq.chat.completions.create({
    "messages": message,
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

  // Send the response to Minecraft chat
  if (response) {
    bot.chat(response);
  }

  // Clear the messages after sending the response
  currentMessageContent = "";  // Reset ongoing message accumulation
  message.push({
    "role": "assistant",
    "content": response.trim()  
  });
  console.log(message);
}

app.use(express.json());

function createBot() {
  const bot = mineflayer.createBot({
    host: 'AdrsihyaSMP.aternos.me',
    version: false,
    username: 'JIYA',
    port: 13981,
    plugins: [AutoAuth],
    AutoAuth: 'IamJiya'
  });

  bot.loadPlugin(pvp);
  bot.loadPlugin(armorManager);
  bot.loadPlugin(pathfinder);

  bot.on('playerCollect', (collector, itemDrop) => {
    if (collector !== bot.entity) return;

    setTimeout(() => {
      const sword = bot.inventory.items().find(item => item.name.includes('sword'));
      if (sword) bot.equip(sword, 'hand');
    }, 150);
  });

  bot.on('playerCollect', (collector, itemDrop) => {
    if (collector !== bot.entity) return;

    setTimeout(() => {
      const shield = bot.inventory.items().find(item => item.name.includes('shield'));
      if (shield) bot.equip(shield, 'off-hand');
    }, 250);
  });

  let guardPos = null;

  function guardArea(pos) {
    guardPos = pos.clone();

    if (!bot.pvp.target) {
      moveToGuardPos();
    }
  }

  function stopGuarding() {
    guardPos = null;
    bot.pvp.stop();
    bot.pathfinder.setGoal(null);
  }

  function moveToGuardPos() {
    const mcData = require('minecraft-data')(bot.version);
    bot.pathfinder.setMovements(new Movements(bot, mcData));
    bot.pathfinder.setGoal(new goals.GoalBlock(guardPos.x, guardPos.y, guardPos.z));
  }

  bot.on('stoppedAttacking', () => {
    if (guardPos) {
      moveToGuardPos();
    }
  });

  bot.on('physicTick', () => {
    if (bot.pvp.target) return;
    if (bot.pathfinder.isMoving()) return;

    const entity = bot.nearestEntity();
    if (entity) bot.lookAt(entity.position.offset(0, entity.height, 0));
  });

  bot.on('physicTick', () => {
    if (!guardPos) return;
    const filter = e => e.type === 'mob' && e.position.distanceTo(bot.entity.position) < 16 &&
      e.mobType !== 'Armor Stand';
    const entity = bot.nearestEntity(filter);
    if (entity) {
      bot.pvp.attack(entity);
    }
  });

  
  bot.on('chat', async (username, chatMessage) => {
    if (chatMessage.startsWith('@JIYA')) {
 
      await handleJIYAMessage(chatMessage, bot);
    } else {

      appendChatMessage(username, chatMessage);
    }
  });

  function moveInCircle() {
    const mcData = require('minecraft-data')(bot.version);
    const movements = new Movements(bot, mcData);
    bot.pathfinder.setMovements(movements);

    const startPosition = bot.entity.position.clone();

    // Define movement offsets for the circular movement
    const positions = [
      { x: 3, z: 0 },  // Move 3 blocks right
      { x: 3, z: 3 },  // Move 3 blocks forward
      { x: 0, z: 3 },  // Move 3 blocks left
      { x: 0, z: 0 }   // Move 3 blocks backward (back to start)
    ];

    let index = 0;

    function moveStep() {
      const goalPos = startPosition.offset(positions[index].x, 0, positions[index].z);
      bot.pathfinder.setGoal(new goals.GoalBlock(goalPos.x, goalPos.y, goalPos.z));
      index = (index + 1) % positions.length; // Move to next position in circle

      // Schedule the next move after 1 minute (60000 milliseconds)
      setTimeout(moveStep, 60000);
    }

    moveStep(); // Start the movement loop
  }

  // Call the circular movement function when the bot spawns
  bot.once('spawn', () => {
    moveInCircle();
  });

  bot.on('kicked', console.log);
  bot.on('error', console.log);
  bot.on('end', createBot);
}

createBot();

