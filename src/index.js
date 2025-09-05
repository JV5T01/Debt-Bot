require('dotenv').config({
 path: '../.env', 
 quiet: 'true'});
const { Client, IntentsBitField, EmbedBuilder, userMention } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { joinVoiceChannel } = require('@discordjs/voice');

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMembers,
  ]
});

const PREFIX = ';';
const LOG_CHANNEL_ID = ''; // Put your own
const DEBT_FILE = path.join(__dirname, 'debt.json');
const COIN_FILE = path.join(__dirname, 'coinamount.json');
const DAILY_FILE = path.join(__dirname, 'daily.json');
const ADMIN_ROLE_IDS = ['']; // Put your own
const MILESTONE_ROLE_IDS = ['']; // Put your own
const DEBT_MILESTONES = [100, 250, 350, 500, 750, 1000, 2000, 3000, 4000, 5000, 10000, ];

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
      if (guildMember.roles.cache.has(MILESTONE_ROLE_IDS)) {
        await guildMember.roles.remove(MILESTONE_ROLE_IDS);
      }
    } catch (err) {
      console.warn(`⚠️ Couldn't remove milestone role from user ${userId}:`, err.message);
    }
  }
}

client.once('ready', () => {
    console.log(`${client.user.tag} is online.`);

    const statuses = [
        { name: 'taking your coins', type: 5 }, // Competing
        { name: 'the debt rise', type: 3 }, // Watching
        { name: 'you gamble', type: 3 }, // Watching
        { name: 'you manage your debts', type: 3 }, // Watching
        { name: 'Men Whimpering Audio 10 hours', type: 2 }, // Listening
        { 
            name: 'my gambling addiction', 
            type: 1, // Streaming
            url: 'https://twitch.tv/jv5t01' // My twitch
        }
    ];

    let i = 0;
    setInterval(() => {
        client.user.setPresence({
            activities: [statuses[i]],
            status: 'online'
        });
        i = (i + 1) % statuses.length;
    }, 10000); // Changes every 10 seconds

    // Set initial status
    client.user.setPresence({
        activities: [statuses[0]],
        status: 'online'
    });
});


  
client.on('messageCreate', message => {
    // Ignore bots
    if (message.author.bot) return;

    const trigger = "men whimpering"; 

    if (message.content.toLowerCase().includes(trigger.toLowerCase())) {
        message.reply("i'm listening to it **because i can**.");
    }
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

          let notifyMessage = `You reached ${milestone} in debt.. `;

          if (milestone === 100) {
            notifyMessage += 'PAY YOUR DEBT';
          } else if (milestone === 250) {
            notifyMessage += 'GET HIM GAYS';
          } else if (milestone === 350) {
            notifyMessage += 'IM 10 MILES AWAY, YOU BETTER RUN.';
          } else if (milestone === 500) {
            notifyMessage += 'YOU\'RE MINE 👅';
          } else if (milestone === 750) {
            notifyMessage += 'PAY.. YOUR.. DEBT.. NOW...';
          } else if (milestone === 1000) {
            notifyMessage += `*you\'re in the basement* | You hit 1,000 in debt.. you know what that means.. 🐟 (How the fuck did you get here? | 1,000 coins in debt..)`;
          } else if (milestone === 2000) {
            notifyMessage += `i'm bringing you to the backyard.. *grabs shotgun* you might wanna run.`;
          } else if (milestone === 3000) {
            notifyMessage += `*shoots you in the back multiple times with my shotgun* are you still alive?`;
          } else if (milestone === 4000) {
            notifyMessage += `YOU'RE STILL ALIVE??`;
          } else if (milestone === 5000) {
            notifyMessage += `alright thats it, how the fuck did you get to 5000 debt`;
          } else if (milestone === 10000) {
            notifyMessage += `what the **FUCK**? WHY ARENT YOU PAYING YOUR DEBTS`;

            try {
              const guildMember = await message.guild.members.fetch(userId);
              await guildMember.timeout(10 * 60 * 1000, 'Reached 10k debt.'); // 10 minutes
            } catch (err) {
              console.warn(`⚠️ Couldn't timeout ${username}:`, err.message);
            }
          }
        
          // Send to channel - await & try/catch!
          try {
            await message.channel.reply(notifyMessage);
          } catch (err) {
            console.warn(`⚠️ Couldn't send message in channel:`, err.message);
          }

          // Add role if 250 milestone
          if (milestone === 250) {
            try {
              const guildMember = await message.guild.members.fetch(userId);
              await guildMember.roles.add(MILESTONE_ROLE_IDS);
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
      sb: 'setbal',
      bal: 'balance',
      lb: 'leaderboard',
      h: 'help',
      give: 'gift',
      r: 'rob', 
      b: 'ban',
      k: 'kick',
      m: 'mute',
    };

    command = aliases[command] || command;

const { EmbedBuilder } = require("discord.js");

if (command) {
  const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);

  if (logChannel) {
    const timestamp = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
    const argsString = args.length > 0 ? args.join(" ") : "(none)";

    const logEmbed = new EmbedBuilder()
      .setColor("Random")
      .setTitle("📝 Command Used")
      .addFields(
        { name: "User", value: `${message.author.tag} (${message.author.id})`, inline: false },
        { name: "Command", value: `\`${command}\``, inline: true },
        { name: "Args", value: argsString, inline: true },
        { name: "_ _", value: "_ _", inline: true },
        { name: "Server", value: message.guild ? message.guild.name : "DM", inline: true},
        { name: "Channel", value: message.channel.name ? `#${message.channel.name}` : "DM", inline: true },
        { name: "Time (EST)", value: timestamp, inline: false },
        { name: "Message Link", value: `[Jump to Message](${message.url})`, inline: false }
      )
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    logChannel.send({ embeds: [logEmbed] });
  }
}

const ALLOWED_CHANNELS = [
  '', // Put
  '', // Your
  '', // Own
  '', // Channel
  '', // IDs
];

const member = message.member;

const isAdmin = member.roles.cache.some(role => ADMIN_ROLE_IDS.includes(role.id));
const isOwner = userId === OWNER_USER_ID; 

if (!ALLOWED_CHANNELS.includes(message.channel.id) && !isAdmin && !isOwner) {
  try {
    await message.delete();
    await message.author.send(
      "You can't do commands in that channel, please go to the `#bot-cmds` channel or something similar."
    );
  } catch (err) {
    console.warn(`Couldn't delete or DM ${message.author.tag}:`, err.message);
  }
  return;
}

    if (command === 'ssd' || command === 'rs') { // Admin Only | Shutdown and Restart commands
      const isRestart = command === 'rs';
      const isOwner = userId === OWNER_USER_ID;

      if (isOwner) {
        try {
          await message.react('✅');
        } catch {}

        const channelId = (''); // Logging channel for shutdowns and restarts
        try {
          const channel = await client.channels.fetch(channelId);
          if (channel && channel.isTextBased()) {
            await channel.send(`<@${client.user.id}> is now ${isRestart ? 'restarting' : 'offline'}..`);
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
        console.log(`${username} ran an owner only command, though the user is not the owner. | SSD/RS`)
        await message.reply('Only the owner can run this command..')
      }
    }


    if (command === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('Debt Bot Commands')
        .setColor('Blue') 
        .setFooter({ text: 'There is a secret command, it is 7 digits \(numbers\), if you find it, then i\'ll be very surprised.' })
        .addFields( // { name: ';', value: '' },
          { name: ';help/h', value: 'Show this help message' },
          { name: ';debt/d', value: 'Check your or someone else\'s debt\nUsage `;debt/d [@user]`' },
          { name: ';pay/p', value: 'Pay off all your debt' },
          { name: ';setdebt/sd', value: '(Admin Only) Set debt for others or yourself\nUsage `;setdebt/sd [@user]`' },
          { name: ';setbal/sb', value: '(Admin Only) Set other users balance\nUsage `;setbal/sb [@user]`'},
          { name: ';balance/bal', value: 'Check your coin balance' },
          { name: ';daily', value: 'Claim 1000 coins daily' },
          { name: ';gamble/g [amount]', value: '1 in 25 chance to double coins' },
          { name: ';tag', value: 'Choose between 3 tags: \n\'issue\'\n\'suggestion\'\n\'dbs\'' },
          { name: ';leaderboard/lb', value: 'Shows a leaderboard with users with the most debt' },
          { name: ';gift/give', value: 'Gift other users some coins!\nUsage `;gift/give [@user] [amount]`'},
          { name: ';start', value: 'Get a head start by getting 10k coins when you use the commands!\nBut you have to have less then 10k in your balance.'},
          { name: ';slots', value: 'Play some slots!\nUsage `;slots [amount]`'},
          { name: ';stats', value: 'Look at other users stats\nUsage `;stats [@user]`' },
          { name: ';work', value: 'have a **JOB** (JOB APPLICATION-), do simply \';work\' to see all jobs\nUsage `;work [job]`' },
          { name: ';ban/b', value: '(Admin Only) Ban users\nUsage `;ban [user] [reason]`' },
          { name: ';kick/k', value: '(Admin Only) Kick users\nUsage `;kick [user] [reason]`' },
          { name: ';mute/m', value: '(Admin Only) Mute users for an amount of time\nUsage `;mute [user] [muted time] [reason]`' },
        )

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
  const hasMilestoneRole = guildMember.roles.cache.has(MILESTONE_ROLE_IDS);

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
      await guildMember.roles.remove(MILESTONE_ROLE_IDS);
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
        .setDescription(`${leaderboardText}\nThis info is across servers.`)
        .setColor('Random');

      return message.reply({ embeds: [embed] });
    }

    if (command === 'setdebt') { // Admin Only | Set your own or others debt.
      const target = message.mentions.users.first();
      const amountArg = target ? args[1] : args[0];
      const amount = parseInt(amountArg);
      const targetId = target ? target.id : userId;
      const targetName = target ? target.username : username;

      if (!ADMIN_ROLE_IDS.some(roleId => message.member.roles.cache.has(roleId))) {
        console.log(`${username} ran an admin only command, though the user does not have an admin role. | SD`)
        return message.reply('You do not have permission to use this command.')
        
      }

      if (message.author.id !== OWNER_USER_ID) {
        return message.reply("You don’t have permission to use this command.")
      }
      
      if (targetId === OWNER_USER_ID && userId !== OWNER_USER_ID) {
        return message.reply('You cannot do anything to the owner of the bot.');
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
      console.log(`${username} has set ${targetName}'s debt to ${amount}.`)
      return message.reply(`Debt for **${targetName}** set to **${amount}**.`);
    }


     if (command === 'balance') { // Check your balance.. obviously.
      if (!coins[userId] || typeof coins[userId] !== 'object') {
        coins[userId] = { username, balance: 0 };
      }
      coins[userId].username = username;
      saveJSON(COIN_FILE, coins);
      return message.reply(`You have ${coins[userId].balance} coins.`);
    }

if (command === 'setbal') { // Admin Only | Set other users balance
  const target = message.mentions.users.first();
  const amountArg = target ? args[1] : args[0];
  const amount = parseInt(amountArg);
  const targetId = target ? target.id : userId;
  const targetName = target ? target.username : username;

  if (!isAdmin) {
    console.log(`${username} ran an admin only command, though the user does not have an admin role. | SB`)
    return message.reply("You don't have permission to use this command.")
  }

  if (targetId === OWNER_USER_ID && userId !== OWNER_USER_ID) {
    return message.reply('You cannot do anything to the owner of the bot.');
  }

  if (isNaN(amount) || amount < 0) {
    return message.reply("Please provide a valid number greater than or equal to 0.");
  }

  if (!coins[targetId]) {
    coins[targetId] = { username: targetName, balance: 0 };
  }

  coins[targetId].balance = amount;
  coins[targetId].username = targetName;

  saveJSON(COIN_FILE, coins);
  console.log(`${username} has set ${targetName}'s balance to ${amount}.`)
  return message.reply(`✅ Set ${targetName}'s balance to ${amount} coins.`);
}


if (command === "ban") { // Admin Only | Bans the mentioned user.
  const userId = message.author.id;

  // Check if user is owner or has one of the admin roles
  const isOwner = userId === OWNER_USER_ID;
  const isAdmin = message.member.roles.cache.some(role => ADMIN_ROLE_IDS.includes(role.id));

  if (!isOwner && !isAdmin) {
    return message.reply("❌ You don’t have permission to use this command.");
  }

  // Get the mentioned user
  const user = message.mentions.users.first();
  if (!user) {
    return message.reply(`⚠️ Please mention a user to ban. Example: ;ban <@${userId}> s`);
  }

  // Extract reason
  const argsWithoutCommand = args.slice(1);
  const reason = argsWithoutCommand.join(" ") || "No reason provided";

  // Get the member object
  const member = message.guild.members.cache.get(user.id);
  if (!member) {
    return message.reply("⚠️ That user is not in this server.");
  }

  // Check if the bot can ban this member
  if (!member.bannable) {
    return message.reply("❌ I cannot ban this user. Their role might be higher than mine.");
  }

  try {
    await member.ban({ reason: `${reason} | Banned by ${message.author.tag}` });
    message.reply(`**${user.tag}** has been banned for \`${reason}\``);
  } catch (err) {
    console.error(err);
    message.reply("⚠️ Something went wrong while trying to ban that user.");
  }
}

if (command === "kick") { // Admin Only | Kicks the mentioned user.
  const userId = message.author.id;
  const username = message.author.username;

  // Check if user is owner or has one of the admin roles
  const isOwner = userId === OWNER_USER_ID;
  const isAdmin = message.member.roles.cache.some(role => ADMIN_ROLE_IDS.includes(role.id));

  if (!isOwner && !isAdmin) {
    return message.reply("❌ You don’t have permission to use this command.");
  }

  // Get the mentioned user
  const user = message.mentions.users.first();
  if (!user) {
    return message.reply("⚠️ Please mention a user to kick. Example: `;kick @jason being rude`");
  }

  // Extract reason
  const argsWithoutCommand = args.slice(1);
  const reason = argsWithoutCommand.join(" ") || "No reason provided";

  // Get the member object
  const member = message.guild.members.cache.get(user.id);
  if (!member) {
    return message.reply("⚠️ That user is not in this server.");
  }

  // Check if the bot can kick this member
  if (!member.kickable) {
    return message.reply("❌ I cannot kick this user. Their role might be higher than mine.");
  }

  try {
    await member.kick(`${reason} | Kicked by ${message.author.tag}`);
    message.reply(`**${user.tag}** has been kicked for \`${reason}\``);
  } catch (err) {
    console.error(err);
    message.reply("⚠️ Something went wrong while trying to kick that user.");
  }
}

function parseDuration(input) {
  if (!input) return null;
  const match = input.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case "s": return value * 1000;
    case "m": return value * 60 * 1000;
    case "h": return value * 60 * 60 * 1000;
    case "d": return value * 24 * 60 * 60 * 1000;
    default: return null;
  }
}

if (command === "mute") { // Admin Only | Mute users for a specified amount of time
  const userId = message.author.id;
  const username = message.author.username;

  const isOwner = userId === OWNER_USER_ID;
  const isAdmin = message.member.roles.cache.some(role => ADMIN_ROLE_IDS.includes(role.id));
  if (!isOwner && !isAdmin)
    return message.reply("❌ You don’t have permission to use this command.");

  const user = message.mentions.users.first();
  if (!user) return message.reply("⚠️ Please mention a user to mute. Example: `;mute @user 10m being loud`");

  const member = message.guild.members.cache.get(user.id);
  if (!member) return message.reply("⚠️ That user is not in this server.");
  if (!member.moderatable) return message.reply("❌ I cannot mute this user. Their role might be higher than mine.");

  // Check if already muted
  if (member.communicationDisabledUntilTimestamp && member.communicationDisabledUntilTimestamp > Date.now()) {
    const remainingMs = member.communicationDisabledUntilTimestamp - Date.now();
    const remainingSeconds = Math.floor(remainingMs / 1000);
    const remainingMinutes = Math.floor(remainingSeconds / 60);
    const remainingHours = Math.floor(remainingMinutes / 60);
    const remainingDays = Math.floor(remainingHours / 24);

    let remainingStr = "";
    if (remainingDays > 0) remainingStr += `${remainingDays}d `;
    if (remainingHours % 24 > 0) remainingStr += `${remainingHours % 24}h `;
    if (remainingMinutes % 60 > 0) remainingStr += `${remainingMinutes % 60}m `;
    if (remainingSeconds % 60 > 0) remainingStr += `${remainingSeconds % 60}s`;

    return message.reply(`⚠️ \`${user.username}\` is already muted. Time remaining: **${remainingStr.trim()}**`);
  }

  const durationArg = args[1];
  if (!durationArg) return message.reply("⚠️ Please specify a duration. Example: `10m`, `1h`, `30s`");

  const duration = parseDuration(durationArg);
  if (!duration) return message.reply("⚠️ Invalid duration. Use `30s`, `10m`, `1h`, or `1d`.");
  if (duration > 2419200000) return message.reply("⚠️ Maximum mute duration is 28 days.");

  const reason = args.slice(2).join(" ") || "No reason provided";

   try {
    await user.send(`⚠️ You have been muted in **${message.guild.name}** for \`${durationArg}\` Reason: \`${reason}\``);
  } catch (dmErr) {
    console.warn(`Could not DM ${user.tag} about mute:`, dmErr.message);
  }

  try {
    await member.timeout(duration, `${reason} | Muted by ${message.author.tag}`);
    message.reply(`✅ **${user.username}** has been muted for a duration of \`${durationArg}\` for the reason \`${reason}\`.`);
  } catch (err) {
    console.error(err);
    message.reply("⚠️ Something went wrong while trying to mute that user.");
  }
}

// IDs of roles to give/remove for moderators
const MOD_ROLE_IDS = ["", ""]; // replace with your role IDs

if (command === "mod" || command === "unmod") {
  const userId = message.author.id;
  const username = message.author.username;

  // Check if the author is the owner
  const isOwner = userId === OWNER_USER_ID;
  if (!isOwner) return message.reply("❌ You don’t have permission to use this command.");

  const user = message.mentions.users.first();
  if (!user) return message.reply(`⚠️ Please mention a user. Example: ;${command} @user`);

  const member = message.guild.members.cache.get(user.id);
  if (!member) return message.reply("⚠️ That user is not in this server.");

  if (command === "mod") {
    // Give roles
    const addedRoles = [];
    for (const roleId of MOD_ROLE_IDS) {
      const role = message.guild.roles.cache.get(roleId);
      if (!role) continue;

      if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role).catch(console.error);
        addedRoles.push(role.name);
      }
    }

    if (addedRoles.length === 0) {
      message.reply(`⚠️ ${user.username} already has all mod roles.`);
    } else {
      message.reply(`✅ ${user.username} has been given roles: ${addedRoles.join(", ")}`);
    }
  } else if (command === "unmod") {
    // Remove roles
    const removedRoles = [];
    for (const roleId of MOD_ROLE_IDS) {
      const role = message.guild.roles.cache.get(roleId);
      if (!role) continue;

      if (member.roles.cache.has(role.id)) {
        await member.roles.remove(role).catch(console.error);
        removedRoles.push(role.name);
      }
    }

    if (removedRoles.length === 0) {
      message.reply(`⚠️ ${user.username} had none of the mod roles.`);
    } else {
      message.reply(`✅ ${user.username} has had roles removed: ${removedRoles.join(", ")}`);
    }
  }
}

// ;leave command - Owner only, makes the bot leave the server
if (command === 'leaveserver1024') {
  if (message.author.id !== OWNER_USER_ID) {
    return message.reply("Only the bot owner can use this command.");
  }

  await message.reply("Leaving the server...");
  message.guild.leave()
    .then(() => console.log(`Bot left the server: ${message.guild.name} (${message.guild.id})`))
    .catch(err => {
      console.error("Error leaving server:", err);
      message.channel.reply("There was an error trying to leave the server.");
    });
}


if (command === 'daily') {
  const userId = message.author.id;
  const username = message.author.username;

  const cooldown = 24 * 60 * 60 * 1000; // 24 hours in ms
  const now = Date.now();

  if (dailyClaims[userId] && now - dailyClaims[userId] < cooldown) {
    const nextClaim = Math.floor((dailyClaims[userId] + cooldown) / 1000);
    return message.reply(`You already claimed your daily coins.\n\nCome back **<t:${nextClaim}:R>**.`);
  }

  const amount = 1000;

  if (!coins[userId] || typeof coins[userId] !== 'object') {
    coins[userId] = { username, balance: 0 };
  }

  coins[userId].username = username;
  coins[userId].balance += amount;
  dailyClaims[userId] = now; // store the timestamp instead of a date string

  saveJSON(COIN_FILE, coins);
  saveJSON(DAILY_FILE, dailyClaims);

  const nextClaim = Math.floor((now + cooldown) / 1000);
  return message.reply(`You claimed your daily reward of ${amount} coins!\n\nCome back <t:${nextClaim}:R>.`);
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

      const win = Math.floor(Math.random() * 3) === 0; // 1 in 3 chance

      if (win) {
        const winAmount = Math.floor(Math.random() * amount) + 1;
        coins[userId].balance += amount;
        await message.reply(`🎉 You won! Your new balance is **${coins[userId].balance}** coins.`);
      } else {
        const lossAmount = Math.floor(Math.random() * amount) + 1;
        coins[userId].balance -= lossAmount;
        await message.reply(`💀 You lost ${lossAmount} coins. Your new balance is **${coins[userId].balance}** coins.`);
      }

      coins[userId].username = username;
      saveJSON(COIN_FILE, coins);
    }
  
const tags = {
    issue: "If you have an issue with the bot, please create a ticket in the [DB Support Server](https://discord.gg/Hsutzpv6MM).",
    suggestion: "If you have a feature suggestion, go to the [DB Support Server](https://discord.gg/Hsutzpv6MM)!",
    dbs: "Join the [DB Support Server](https://discord.gg/Hsutzpv6MM) if you have any issues or suggestions.",
};

if (message.content.startsWith(';tag ')) {
    const args = message.content.slice(5).trim().split(/ +/);
    const tagName = args.join(' ').toLowerCase();

    if (!tagName) {
        return message.reply("Please provide a tag name, e.g., `;tag issue`.");
    }

    const tagContent = tags[tagName];
    if (!tagContent) {
        return message.reply(`No tag found for \`${tagName}\`.`);
    }

    const embed = new EmbedBuilder()
        .setAuthor({ name: 'Debt Bot' })
        .setTitle(`Tag: ${tagName}`)
        .setDescription(tagContent)
        .setColor(0x5865F2)
        .setTimestamp();

    message.channel.send({ embeds: [embed] });
}

if (command === "gift") {
  const senderId = message.author.id;
  const targetUser = message.mentions.users.first();
  if (!targetUser) return message.reply("Please mention a user to gift coins to.");
  const targetId = targetUser.id;

  // Parse amount (supports 10k, 5,000)
  const rawAmount = args.slice(1).join("").replace(/,/g, "").toLowerCase();
  const amount = parseInt(rawAmount.replace(/k/g, "000"));
  if (isNaN(amount) || amount <= 0) return message.reply("Please provide a valid amount to gift.");

  // Ensure both users exist in the coin file
  if (!coins[senderId]) coins[senderId] = { username: message.author.username, balance: 0 };
  if (!coins[targetId]) coins[targetId] = { username: targetUser.username, balance: 0 };

  if (coins[senderId].balance < amount) return message.reply("You don’t have enough coins to gift that amount.");

  const executeGift = () => {
    coins[senderId].balance -= amount;
    coins[targetId].balance += amount;

    fs.writeFileSync(COIN_FILE, JSON.stringify(coins, null, 2));
    message.reply(`💸 You gifted **${amount} coins** to ${targetUser.tag}!`);
  };

  if (amount >= 10000) {
    message.reply(`⚠ Warning: You are gifting **${amount} coins**, this is over the 10,000 limit for a warning.\nReply with **yes** or **no** within 15 seconds.`)
      .then(() => {
        const filter = m => m.author.id === senderId && ["yes", "no"].includes(m.content.toLowerCase());
        message.channel.awaitMessages({ filter, max: 1, time: 15000, errors: ['time'] })
          .then(collected => {
            if (collected.first().content.toLowerCase() === "yes") executeGift();
            else message.reply("Gift cancelled ❌");
          })
          .catch(() => message.reply("No response received. Gift cancelled ❌"));
      });
  } else {
    executeGift();
  }
}

if (command === "start") {
  const userId = message.author.id;

  // If user already has an entry
  if (coins[userId] && typeof coins[userId].balance === "number" && coins[userId].balance > 9999) {
    return message.reply("You already have a balance of 10,000 or over, your request for 10,000 more has been rejected.");
  }

  // Initialize the user with starting coins
  coins[userId] = {
    username: message.author.username,
    balance: 10000 // starting amount
  };

  fs.writeFileSync(COIN_FILE, JSON.stringify(coins, null, 2));
  return message.reply("You’ve received **10,000 coins** to start your journey.");
}

// Rob command
if (command === 'rob') {
  const target = message.mentions.users.first();
  const robberId = message.author.id;

  if (!target) {
    return message.reply("❌ You need to mention someone to rob.");
  }
  if (target.id === robberId) {
    return message.reply("❌ You can’t rob yourself.");
  }

  if (target.id === OWNER_USER_ID) {
       return message.reply('You cannot do anything to the owner of the bot.')
  }  

  // Make sure both robber & target have balances
  if (!coins[robberId] || typeof coins[robberId] !== "object") {
    coins[robberId] = { username: message.author.username, balance: 0 };
  }
  if (!coins[target.id] || typeof coins[target.id] !== "object") {
    coins[target.id] = { username: target.username, balance: 0 };
  }

  const robberBalance = coins[robberId].balance;
  const targetBalance = coins[target.id].balance;

  if (targetBalance < 250) {
    return message.reply("💤 That user is too broke to rob.");
  }

  // Success chance
  const success = Math.random() < 0.7; // 40% chance

  if (success) {
    // Random steal between 10% - 30% of target's balance
    const amount = Math.floor(targetBalance * (0.1 + Math.random() * 0.4));

    coins[robberId].balance += amount;
    coins[target.id].balance -= amount;

    fs.writeFileSync(COIN_FILE, JSON.stringify(coins, null, 2));

    return message.reply(`You successfully robbed **${target.username}** and stole **${amount} coins**.`);
  } else {
    // Failed robbery → robber loses some coins instead
    const fine = Math.min(robberBalance, Math.floor(200 + Math.random() * 300));

    coins[robberId].balance -= fine;
    fs.writeFileSync(COIN_FILE, JSON.stringify(coins, null, 2));

    return message.reply(`🚨 You got caught trying to rob **${target.username}** and had to pay a fine of **${fine} coins**.`);
  }
}

if (command === "slots") {
  function parseAmount(input) {
    if (!input) return NaN;
    const match = input.toLowerCase().match(/^(\d+)([kmbt]?)$/);
    if (!match) return NaN;

    let num = parseInt(match[1], 10);
    const suffix = match[2];

    switch (suffix) {
      case "k": num *= 1_000; break;
      case "m": num *= 1_000_000; break;
      case "b": num *= 1_000_000_000; break;
      case "t": num *= 1_000_000_000_000; break;
    }

    return num;
  }

  const bet = parseAmount(args[0]);
  const userId = message.author.id;

  // Ensure user exists with balance
  if (!coins[userId] || typeof coins[userId].balance !== "number") {
    coins[userId] = {
      username: message.author.username,
      balance: 0
    };
  }

  if (isNaN(bet) || bet <= 0) {
    return message.reply("You must bet a number greater than 0.");
  }

  if (coins[userId].balance < bet) {
    return message.reply("You don’t have enough coins to bet that amount.");
  }

  // Subtract bet upfront
  coins[userId].balance -= bet;

  const slotItems = ["🍒", "🍋", "🍊", "🍉", "⭐", "7️⃣"];
  const result = [
    slotItems[Math.floor(Math.random() * slotItems.length)],
    slotItems[Math.floor(Math.random() * slotItems.length)],
    slotItems[Math.floor(Math.random() * slotItems.length)]
  ];

  message.reply("Spinning the slots...").then(sentMessage => {
    setTimeout(() => {
      let outcomeText = "";

      if (result[0] === result[1] && result[1] === result[2]) {
        coins[userId].balance += bet * 5;
        outcomeText = `🎉 Jackpot! You won ${bet * 5} coins!`;
      } else if (result[0] === result[1] || result[1] === result[2] || result[0] === result[2]) {
        coins[userId].balance += bet * 2;
        outcomeText = `✨ Nice! You won ${bet * 2} coins!`;
      } else {
        outcomeText = `😢 You lost ${bet} coins.`;
      }

      outcomeText += `\n💰 New Balance: ${coins[userId].balance}`;

      sentMessage.edit(`${result.join(" | ")}\n${outcomeText}`);

      const fs = require("fs");
      fs.writeFileSync(COIN_FILE, JSON.stringify(coins, null, 2));
    }, 2000);
  });
}

if (command === 'stats') {
  let targetUser = message.mentions.users.first() || message.author;
  let targetId = targetUser.id;
  let targetName = targetUser.username;

  if (!coins[targetId]) {
    coins[targetId] = { username: targetName, balance: 0 };
  }
  if (!userDebts[targetId]) {
    userDebts[targetId] = { username: targetName, debt: 0, milestones: [] };
  }

  const balance = coins[targetId].balance ?? 0;
  const debt = userDebts[targetId].debt ?? 0;

  const embed = {
    color: 0xFFD700, // gold color
    title: `${targetName}'s Stats`,
    fields: [
      { name: '💰 Balance', value: `${balance} coins`, inline: true },
      { name: '📉 Debt', value: `${debt} coins`, inline: true }
    ],
    footer: { text: `Requested by ${message.author.username}` },
    timestamp: new Date()
  };

  return message.reply({ embeds: [embed] });
}

if (command === 'work') {
  const userId = message.author.id;
  const username = message.author.username;

  if (!coins[userId]) {
    coins[userId] = { username, balance: 0 };
  }

  // Predefined jobs with min and max earnings
  const jobs = {
    lawnmower: { min: 10, max: 50 },
    farmer: { min: 50, max: 150 },
    miner: { min: 100, max: 300 },
    banker: { min: 200, max: 500 }
  };

  const jobArg = args[0]?.toLowerCase();
  if (!jobArg || !jobs[jobArg]) {
    return message.reply(
      `Please specify a valid job. Available jobs:\n` +
      Object.keys(jobs).map(j => `- ${j}`).join('\n') +
      `\nUsage: ;work <job>`
    );
  }

  const job = jobs[jobArg];
  const earnings = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
  coins[userId].balance += earnings;
  coins[userId].username = username;

  saveJSON(COIN_FILE, coins);

  return message.reply(`💼 ${username} worked as a **${jobArg}** and earned **${earnings} coins**! Your new balance is **${coins[userId].balance} coins**.`);
}



if (command === 'dih' | command === 'dihh') {
  message.reply('dihh..🥀💔')
}

// ;selfelim command
if (command === 'selfelim') {
  const filter = (m) => m.author.id === userId;
  message.reply("⚠️ Are you sure you want to self-eliminate?\nThis will clear your debt and balance.\nType `confirm` to proceed or `cancel` to abort. (15s)");

  try {
    const collected = await message.channel.awaitMessages({ filter, max: 1, time: 15000, errors: ['time'] });
    const response = collected.first().content.toLowerCase();

    if (response === 'confirm') {
      // Timeout user for 5 minutes
      const guildMember = await message.guild.members.fetch(userId);
      try {
      if (coins[userId]) coins[userId].balance = 0;
      if (userDebts[userId]) {
        userDebts[userId].debt = 0;
        userDebts[userId].milestones = [];
      }
        await guildMember.timeout(5 * 60 * 1000, "Self-eliminated");
      } catch (err) {
        console.log(`${username} self-eliminated, but the bot could not time out the user, the bot may not have the right permissions.`)
        return message.reply("❌ I couldn't timeout this user, but their debt and balance have been cleared.");
      }

      // Clear their balance and debt
      

      saveJSON(COIN_FILE, coins);
      saveJSON(DEBT_FILE, userDebts);

      return message.reply("✅ You have self-eliminated.\nYour debt and balance are reset, and you have been timed out for 5 minutes.");
    } else {
      return message.reply("❎ Self-elimination canceled.");
    }
  } catch (err) {
    return message.reply("⌛ You took too long to respond. Self-elimination canceled.");
  }
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
      await channel.send(`<@${client.user.id}> is now offline.`);
    }
  } catch (err) {
    console.error('Failed to send shutdown message:', err.message);
  }

  console.log(`${client.user.tag} is now offline.`);
  process.exit();
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
