import Discord from 'discord.js'

const bot = new Discord.Client()

bot.login(process.env.DISCORD_TOKEN)

export const discordReport = async (reportedBy: string, postLink: string) => {
  const channel = await bot.channels.fetch('719793411514957935')
  await (channel as Discord.TextChannel).send(
    `${reportedBy} reported ${postLink}`
  )
}

export const discordSendFeedback = async (
  feedback: string,
  username: string
) => {
  const channel = await bot.channels.fetch('738466811242348604')
  await (channel as Discord.TextChannel).send(
    `Feedback from ${username}: ${feedback}`
  )
}
