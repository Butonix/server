const galaxiesNames = [
  'Music',
  'Gaming',
  'Programming',
  'Photography',
  'Memes & Humor',
  'Movies, TV & Entertainment',
  'News & Politics',
  'Drugs',
  'Health & Fitness',
  'Discussion',
  'Technology',
  'Finance & Business',
  'Outdoors & Nature',
  'Sports',
  'Food',
  'Science',
  'Writing',
  'Art',
  'Education',
  'Spirituality, Religion & Philosophy',
  'Fashion',
  'Places',
  'Other'
]

export const galaxiesList = galaxiesNames.map((g) => ({
  name: g
    .toLowerCase()
    .replace(/,/g, '')
    .replace(/& /g, '')
    .replace(/ /, '_'),
  fullName: g
}))
