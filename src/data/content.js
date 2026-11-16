export const photos = {
  hero: '/images/community-gathering.webp',
  group: '/images/community-group.webp',
  learning: '/images/learning-session.webp',
  women: '/images/women-leadership.webp',
  community: '/images/community-celebration.webp',
  workshop: '/images/classroom-workshop.webp',
  portrait: '/images/community-conversation.webp',
  hands: '/images/community-garden.webp',
  classroom: '/images/classroom-learning.webp',
}

export const programs = [
  {
    slug: 'sauti-ya-dada', category: 'Girls’ empowerment',
    title: 'Sauti Ya Dada Program (SYD)',
    description: 'A girls’ empowerment program focused on leadership, advocacy, and sexual and reproductive health and rights (SRHR) knowledge.',
    image: photos.women, alt: 'Women sharing knowledge and leadership',
    points: [
      'Mentorship circles connecting girls with experienced women leaders',
      'Clubs and revision clubs to support academic growth and confidence',
      'SMS messages and podcasts to inspire girls and build peer networks',
      'Creative Advocacy Practicum (CAP) for girls to lead community projects',
    ],
  },
  {
    slug: 'leadership-mentorship', category: 'Youth development',
    title: 'Leadership & Mentorship',
    description: 'Connecting youth with experienced leaders and developing essential skills.',
    image: photos.learning, alt: 'Young people taking part in a learning session',
    points: [
      'Mentorship programs connecting youth with experienced leaders',
      'Development of leadership, advocacy, and problem-solving skills',
      'Peer support and safe spaces for discussing challenges',
    ],
  },
  {
    slug: 'sports-wellness', category: 'Wellbeing',
    title: 'Sports & Wellness',
    description: 'Promoting physical and mental wellness through sports activities.',
    image: '/images/DSC09598.webp', alt: 'Young people coming together as a community',
    points: [
      'Activities like football, basketball, yoga, and dance',
      'Promotes physical and mental wellness',
      'Encourages teamwork, discipline, and resilience',
    ],
  },
  {
    slug: 'community-engagement-advocacy', category: 'Community',
    title: 'Community Engagement & Advocacy',
    description: 'Involving youth in environmental protection and advocacy campaigns.',
    image: '/images/DSC01172.webp', alt: 'Community members gathered together',
    points: [
      'Projects involving youth in environmental protection',
      'Creative initiatives and advocacy campaigns',
      'Encourages civic engagement and social responsibility',
      'Creative Advocacy Practicum (CAP) to address community issues',
    ],
  },
]

export const projects = [
  { slug: 'community-learning-spaces', title: 'Community learning spaces', category: 'Education', image: '/images/school-building.webp', description: 'A project concept for welcoming community spaces where young people can learn, connect, and explore new ideas.' },
  { slug: 'voices-of-young-women', title: 'Voices of young women', category: 'Women’s empowerment', image: '/images/DSC00837.webp', description: 'A proposed platform to make room for young women’s stories, ideas, and leadership in their communities.' },
  { slug: 'neighbourhood-connections', title: 'Neighbourhood connections', category: 'Community', image: '/images/community-mural.webp', description: 'Bringing community members together to share skills, build relationships, and imagine positive local change.' },
]

export const team = [
  {
    name: 'Isimbi Nadia Umugwaneza',
    role: 'Founder',
    bio: 'Provides leadership for Bwiza Youth Bridge’s mission to support young people through education, mentorship, skills development, and community engagement.',
    linkedin: 'https://www.linkedin.com/in/nadia-isimbi-umugwaneza-241843225/',
  },
  {
    name: 'Cyusa Bright Mugwaneza',
    role: 'Marketing Director',
    bio: 'Leads marketing and communications to share Bwiza Youth Bridge’s programs and opportunities with young people, partners, and communities.',
    linkedin: 'https://www.linkedin.com/in/bright-cyusa-858775384/',
  },
]

export const articles = [
  { slug: 'making-room-for-young-voices', category: 'Community', date: 'Coming soon', title: 'Making room for young voices', excerpt: 'A placeholder for stories, reflections, and updates from the Bwiza Youth Bridge community.', image: photos.group },
  { slug: 'learning-together', category: 'Education', date: 'Coming soon', title: 'Learning, together', excerpt: 'A placeholder for news about learning, growth, and community-led ideas.', image: photos.learning },
  { slug: 'the-strength-of-connection', category: 'Stories', date: 'Coming soon', title: 'The strength of connection', excerpt: 'A placeholder for stories celebrating the people and relationships that help communities thrive.', image: photos.community },
]

const galleryPreviewFiles = [
  'classroom-learning.webp',
  'classroom-workshop.webp',
  'community-celebration.webp',
  'community-conversation.webp',
  'community-garden.webp',
  'community-gathering.webp',
]

export const galleryPreviewItems = galleryPreviewFiles.map((filename) => ({
  title: filename.replace(/\.webp$/i, '').replace(/-/g, ' '),
  image: `/images/${filename}`,
}))

const galleryPhoto = (filename, title, alt, height) => ({
  title,
  alt,
  image: `/images/${filename}.webp`,
  thumbnail: `/images/gallery/${filename}-480.webp`,
  srcSet: `/images/gallery/${filename}-480.webp 480w, /images/gallery/${filename}-960.webp 960w`,
  width: 1920,
  height,
})

export const galleryItems = [
  galleryPhoto('DSC01688', 'A community gathered together', 'A large group gathered outside a community building with a painted mural.', 1283),
  galleryPhoto('DSC01070', 'Sharing ideas and experience', 'A woman speaking during a workshop.', 1283),
  galleryPhoto('DSC00871', 'Growing something together', 'Two participants tending a young plant.', 1282),
  galleryPhoto('DSC09694', 'Learning around the table', 'A facilitator speaking with young people seated around a classroom table.', 1280),
  galleryPhoto('DSC01490', 'Community action, hands on', 'Participants working together during an outdoor community activity.', 1282),
  galleryPhoto('DSC00724', 'Making space for a community story', 'Young people painting a mural on a community building.', 1282),
  galleryPhoto('DSC01246', 'Listening, learning, and connecting', 'Participants sitting together during a community discussion.', 1282),
  galleryPhoto('DSC00938', 'Working together outdoors', 'Community members tending a garden together.', 1282),
  galleryPhoto('DSC01123', 'A moment of shared celebration', 'A group raising their hands together outside a painted building.', 1282),
  galleryPhoto('DSC00603', 'Creating something together', 'Participants painting a mural on a community building.', 1282),
  galleryPhoto('DSC01289', 'A voice in the conversation', 'A woman speaking during a community gathering.', 1282),
  galleryPhoto('DSC09589', 'Learning from one another', 'Young people listening during a classroom discussion.', 1280),
]
