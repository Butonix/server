import Discord from 'discord.js'

const bot = new Discord.Client()

if (process.env.DISCORD_TOKEN) {
  bot.login(process.env.DISCORD_TOKEN)
}

export const discordReport = async (reportedBy: string, postLink: string) => {
  const channel = await bot.channels.fetch(process.env.DISCORD_REPORTS_CHANNEL)
  await (channel as Discord.TextChannel).send(
    `${reportedBy} reported ${postLink}`
  )
}

export const discordSendFeedback = async (
  feedback: string,
  username: string
) => {
  const channel = await bot.channels.fetch(process.env.DISCORD_FEEDBACK_CHANNEL)
  await (channel as Discord.TextChannel).send(
    `Feedback from ${username}: ${feedback}`
  )
}
