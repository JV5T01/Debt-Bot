require('dotenv').config({
 path: '../.env', 
 quiet: 'true'});
const { Client, IntentsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMembers,
  ]
});

const PREFIX = ';';
const DEBT_FILE = path.join(__dirname, 'debt.json');
const COIN_FILE = path.join(__dirname, 'coinamount.json');
const DAILY_FILE = path.join(__dirname, 'daily.json');
const ADMIN_ROLE_IDS = ['1368869202802507806', '1361389058235957248', '1357034066200760391', '1401913168799993908', '1141162089830948976', '1404845866631692298'];
const MILESTONE_ROLE_ID = '1401826307154772009';
const DEBT_MILESTONES = [100, 250, 350, 500, 750, 1000];

let userDebts = {};
let coins = {};
let dailyClaims = {};

function safeReadJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return data ? JSON.parse(data) : {};
  } catch (err) {
    console.warn(`⚠️ Failed to read ${filePath}:`, err.message);
    return {};
  }
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`❌ Failed to write ${filePath}:`, err.message);
  }
}

if (fs.existsSync(DEBT_FILE)) userDebts = safeReadJSON(DEBT_FILE);
if (fs.existsSync(COIN_FILE)) coins = safeReadJSON(COIN_FILE);
if (fs.existsSync(DAILY_FILE)) dailyClaims = safeReadJSON(DAILY_FILE);

// Helper: remove milestone role if debt below 250
async function checkAndRemoveMilestoneRoleIfBelowThreshold(message, userId, debt) {
  if (debt < 250) {
    try {
      const guildMember = await message.guild.members.fetch(userId);
      if (guildMember.roles.cache.has(MILESTONE_ROLE_ID)) {
        await guildMember.roles.remove(MILESTONE_ROLE_ID);
      }
    } catch (err) {
      console.warn(`⚠️ Couldn't remove milestone role from user ${userId}:`, err.message);
    }
  }
}

client.once('ready', () => {
  console.log(`${client.user.tag} is online.`);
});

client.on('messageCreate', async message => {
  try {
    if (message.author.bot) return;

    const userId = message.author.id;
    const username = message.author.username;

    if (!message.content.startsWith(PREFIX)) {
      let userEntry = userDebts[userId];
      if (!userEntry) {
        userEntry = userDebts[userId] = { username, debt: 5, milestones: [] };
      } else {
        userEntry.debt += 5;
        userEntry.username = username;
        userEntry.milestones = userEntry.milestones || [];
      }

      // Milestone logic
      for (const milestone of DEBT_MILESTONES) {
        if (userEntry.debt >= milestone && !userEntry.milestones.includes(milestone)) {
          userEntry.milestones.push(milestone);

          let notifyMessage = `<@${userId}> you reached ${milestone} in debt.. `;

          if (milestone === 100) {
            notifyMessage += 'PAY YOUR DEBT';
          } else if (milestone === 250) {
            notifyMessage += 'IM 50 MILES AWAY.';
          } else if (milestone === 350) {
            notifyMessage += 'IM 10 MILES AWAY, YOU BETTER RUN.';
          } else if (milestone === 500) {
            notifyMessage += 'YOU\'RE MINE 👅 (timed out for 10 minutes for reaching 500 debt)';
          } else if (milestone === 750) {
            notifyMessage += 'PAY.. YOUR.. DEBT.. NOW...';
          } else if (milestone === 1000) {
            notifyMessage += `*you\'re in the basement* | You hit 1,000 in debt.. you know what that means.. 🐟 (How the fuck did you get here? | 1,000 coins in debt..)`;
          
            try {
              const guildMember = await message.guild.members.fetch(userId);
              await guildMember.timeout(10 * 60 * 1000, 'Reached 500 debt.'); // 10 minutes
            } catch (err) {
              console.warn(`⚠️ Couldn't timeout ${username}:`, err.message);
            }
          }

          // Send DM
          try {
            await message.author.send(notifyMessage);
          } catch (err) {
            console.warn(`⚠️ Couldn't DM ${username}:`, err.message);
          }

          // Send to channel - await & try/catch!
          try {
            await message.channel.send(notifyMessage);
          } catch (err) {
            console.warn(`⚠️ Couldn't send message in channel:`, err.message);
          }

          // Add role if 250 milestone
          if (milestone === 250) {
            try {
              const guildMember = await message.guild.members.fetch(userId);
              await guildMember.roles.add(MILESTONE_ROLE_ID);
            } catch (err) {
              console.warn(`⚠️ Couldn't assign role to ${username}:`, err.message);
            }
          }
        }
      }

      // Check if role should be removed if debt dropped below 250 (unlikely on message, but safe)
      await checkAndRemoveMilestoneRoleIfBelowThreshold(message, userId, userEntry.debt);

      saveJSON(DEBT_FILE, userDebts);
      return; // Early return for non-command messages
    }

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    let command = args.shift().toLowerCase();

    // Handle aliases
    const aliases = {
      d: 'debt',
      p: 'pay',
      g: 'gamble',
      sd: 'setdebt',
      b: 'balance',
      lb: 'leaderboard',
      h: 'help'
    };

    command = aliases[command] || command;

    // Shutdown / Restart commands with reaction and message
    if (command === 'ssd' || command === 'rs') {
      const isRestart = command === 'rs';
      const isAdmin = ADMIN_ROLE_IDS.some(roleId => message.member.roles.cache.has(roleId));

      if (isAdmin) {
        try {
          await message.react('✅');
        } catch {}

        const channelId = ('1401833337487753316', '1404851796337229896');
        try {
          const channel = await client.channels.fetch(channelId);
          if (channel && channel.isTextBased()) {
            await channel.send(`<@&1404856537284874392> <@${client.user.id}> is now ${isRestart ? 'restarting' : 'offline'}..`);
          }
        } catch (err) {
          console.error('Failed to send shutdown/restart message:', err.message);
        }

        console.log(`${client.user.tag} is now ${isRestart ? 'restarting' : 'offline'}.`);
        process.exit(isRestart ? 1 : 0);
      } else {
        try {
          await message.react('❌');
        } catch {}
        await message.reply('You do not have permission to use this command.');
      }
      return;
    }

    // Your other commands here:
    if (command === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('Debt Bot Commands')
        .setColor('Blue')
        .addFields(
          { name: ';help/h', value: 'Show this help message' },
          { name: ';debt/d [@user]', value: 'Check your or someone else\'s debt' },
          { name: ';pay/p', value: 'Pay off all your debt' },
          { name: ';setdebt/sd [@user] [amount]', value: '(Admin Only) Set debt for others or yourself' },
          { name: ';balance/b', value: 'Check your coin balance' },
          { name: ';daily', value: 'Claim 1000 coins daily.' },
          { name: ';gamble/g [amount]', value: '1 in 25 chance to double coins' },
          { name: ';leaderboard/lb', value: 'Shows a leaderboard with users with the most debt' }
        );
      return message.reply({ embeds: [embed] });
    }

    if (command === 'debt') { // Check yours or someone elses debts.
      const target = message.mentions.users.first() || message.author;
      const entry = userDebts[target.id];
      const amount = entry ? entry.debt : 0;
      return message.reply(`<@${target.id}> owes ${amount} coins.`);
    }

    if (command === 'pay') { // Pay your debts.
  if (!userDebts[userId]) {
    userDebts[userId] = { username, debt: 0, milestones: [] };
  }
  if (!coins[userId]) {
    coins[userId] = { username, balance: 0 };
  }

  const debtAmount = userDebts[userId].debt;
  const coinBalance = coins[userId].balance;

  if (debtAmount === 0) {
    return message.reply('You have no debt to pay.');
  }

  const guildMember = await message.guild.members.fetch(userId);
  const hasMilestoneRole = guildMember.roles.cache.has(MILESTONE_ROLE_ID);

  // If user does NOT have enough coins to pay debt:
  if (coinBalance < debtAmount) {
    return message.reply(`You do not have enough coins to pay your debt of ${debtAmount}. You only have ${coinBalance} coins.`);
  }

  // User has enough coins, pay debt and remove role if applicable
  coins[userId].balance -= debtAmount;
  userDebts[userId].debt = 0;
  userDebts[userId].milestones = [];

  // Remove milestone role if user has it
  try {
    if (hasMilestoneRole) {
      await guildMember.roles.remove(MILESTONE_ROLE_ID);
    }
  } catch (err) {
    console.warn(`⚠️ Couldn't remove milestone role from ${username}:`, err.message);
  }

  coins[userId].username = username;
  userDebts[userId].username = username;

  saveJSON(COIN_FILE, coins);
  saveJSON(DEBT_FILE, userDebts);

  return message.reply(`Your debt of ${debtAmount} coins has been paid off. Your new balance is ${coins[userId].balance} coins.`);
}



    if (command === 'leaderboard') { // What do you think? ITS A LEADERBOARD-
      const sorted = Object.entries(userDebts)
        .sort(([, a], [, b]) => b.debt - a.debt)
        .slice(0, 10);

      if (sorted.length === 0) return message.reply('No debt records found.');

      const leaderboardText = sorted
        .map(([id, data], i) => `${i + 1}. ${data.username} — $${data.debt}`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle('Top 10 people with debt')
        .setDescription(leaderboardText)
        .setColor(0xff0000);

      return message.reply({ embeds: [embed] });
    }

    if (command === 'setdebt') { // Set your own or others debt.
      const target = message.mentions.users.first();
      const amountArg = target ? args[1] : args[0];
      const amount = parseInt(amountArg);
      const targetId = target ? target.id : userId;
      const targetName = target ? target.username : username;

      if (!ADMIN_ROLE_IDS.some(roleId => message.member.roles.cache.has(roleId))) {
        return message.reply('You do not have permission to use this command.');
      }

      if (isNaN(amount)) {
        return message.reply('Please provide a valid number.');
      }

      if (!userDebts[targetId]) {
        userDebts[targetId] = { username: targetName, debt: amount, milestones: [] };
      } else {
        userDebts[targetId].debt = amount;
        userDebts[targetId].username = targetName;
      }

      saveJSON(DEBT_FILE, userDebts);
      return message.reply(`Debt for <@${targetId}> set to ${amount}.`);
    }

    if (command === 'balance') { // Check your balance.. obviously.
      if (!coins[userId] || typeof coins[userId] !== 'object') {
        coins[userId] = { username, balance: 0 };
      }
      coins[userId].username = username;
      saveJSON(COIN_FILE, coins);
      return message.reply(`You have ${coins[userId].balance} coins.`);
    }

    if (command === 'daily') { // Gives you 1000 coins daily when the command is done.
      const today = new Date().toDateString();
      if (dailyClaims[userId] === today) {
        return message.reply('You already claimed your daily coins today.');
      }
      const amount = 1000;

      if (!coins[userId] || typeof coins[userId] !== 'object') {
        coins[userId] = { username, balance: 0 };
      }

      coins[userId].username = username;
      coins[userId].balance += amount;
      dailyClaims[userId] = today;

      saveJSON(COIN_FILE, coins);
      saveJSON(DAILY_FILE, dailyClaims);

      return message.reply(`You claimed your daily reward of ${amount} coins. Come back in 24 hours.`);
    }

    if (command === 'gamble') { // LETS GO GAMBLING 🎰
      const amount = parseInt(args[0]);
      if (isNaN(amount) || amount <= 0) {
        return message.reply('Please enter a valid amount to gamble.');
      }

      if (!coins[userId] || typeof coins[userId] !== 'object') {
        coins[userId] = { username, balance: 0 };
      }

      const balance = coins[userId].balance;
      if (balance < amount) {
        return message.reply('You do not have enough coins to gamble that amount.');
      }

      const win = Math.floor(Math.random() * 5) === 0;

      if (win) {
        coins[userId].balance += amount;
        await message.reply(`🎉 You won! Your new balance is ${coins[userId].balance} coins.`);
      } else {
        const lossAmount = Math.floor(Math.random() * amount) + 1;
        coins[userId].balance -= lossAmount;
        await message.reply(`💀 You lost ${lossAmount} coins. Your new balance is ${coins[userId].balance} coins.`);
      }

      coins[userId].username = username;
      saveJSON(COIN_FILE, coins);
    }

  } catch (err) {
    console.error('💥 Error in messageCreate event:', err);
  }
});

client.login(process.env.TOKEN);

const shutdown = async () => {
  const channelId = '1404851796337229896';

  try {
    const channel = await client.channels.fetch(channelId);
    if (channel && channel.isTextBased()) {
      await channel.send(`<@&1404856537284874392> <@${client.user.id}> is now offline.`);
    }
  } catch (err) {
    console.error('Failed to send shutdown message:', err.message);
  }

  console.log(`${client.user.tag} is now offline.`);
  process.exit();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
