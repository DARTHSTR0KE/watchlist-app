export interface WheelItem {
  id: string
  title: string
  posterPath: string | null
  // Stand-in only: no verified real backdrop_path was available for these
  // placeholder entries, so this currently reuses the poster image. Heavy
  // blur/darken in the result modal hides the portrait crop reasonably
  // well. Swap in a real backdrop_path once live TMDB data is wired up.
  backdropPath: string | null
  year: number
  runtimeMinutes: number
  genres: string[]
  rating: number
  synopsis: string
}

export const INITIAL_TITLES: WheelItem[] = [
  {
    id: 'godfather',
    title: 'The Godfather',
    posterPath: '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg',
    backdropPath: '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg',
    year: 1972,
    runtimeMinutes: 175,
    genres: ['Crime', 'Drama'],
    rating: 8.7,
    synopsis:
      "When the aging patriarch of the Corleone crime family is nearly killed in an assassination attempt, his youngest son is pulled from civilian life into the family business. What begins as a reluctant defense of his father's empire becomes a methodical rise to power. Loyalty, betrayal, and the cost of survival reshape every relationship around him. By the time the dust settles, the quiet college graduate who wanted nothing to do with the family is the coldest operator among them.",
  },
  {
    id: 'spirited-away',
    title: 'Spirited Away',
    posterPath: '/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg',
    backdropPath: '/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg',
    year: 2001,
    runtimeMinutes: 125,
    genres: ['Animation', 'Fantasy', 'Family'],
    rating: 8.5,
    synopsis:
      'Moving to a new town, a sullen ten-year-old wanders with her parents into what seems to be an abandoned theme park. It is nothing of the sort. Trapped in a hidden world of spirits and shape-shifting sorcery, she must take a job in a bathhouse for gods to have any hope of freeing her family and finding her way home.',
  },
  {
    id: 'mad-max-fury-road',
    title: 'Mad Max: Fury Road',
    posterPath: '/8tZYtuWezp8JbcsvHYO0O46tFbo.jpg',
    backdropPath: '/8tZYtuWezp8JbcsvHYO0O46tFbo.jpg',
    year: 2015,
    runtimeMinutes: 120,
    genres: ['Action', 'Adventure', 'Science Fiction'],
    rating: 7.6,
    synopsis:
      'In a cracked, waterless wasteland ruled by a warlord, a drifter and a renegade rig driver join forces to smuggle five escaped captives across hostile desert. What starts as a getaway becomes an all-out war fought at full speed, chased by an army of chrome-painted fanatics who will not stop until the sand runs red.',
  },
  {
    id: 'parasite',
    title: 'Parasite',
    posterPath: '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
    backdropPath: '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
    year: 2019,
    runtimeMinutes: 133,
    genres: ['Comedy', 'Thriller', 'Drama'],
    rating: 8.5,
    synopsis:
      'A struggling family cons its way, one fabricated résumé at a time, into the household staff of a wealthy family living in a beautiful hillside home. The arrangement works better than anyone could have hoped, until a discovery beneath the house turns a clever scheme into something none of them saw coming.',
  },
  {
    id: 'grand-budapest-hotel',
    title: 'The Grand Budapest Hotel',
    posterPath: '/eWdyYQreja6JGCzqHWXpWHDrrPo.jpg',
    backdropPath: '/eWdyYQreja6JGCzqHWXpWHDrrPo.jpg',
    year: 2014,
    runtimeMinutes: 100,
    genres: ['Comedy', 'Drama'],
    rating: 8.1,
    synopsis:
      'Between the two world wars, a legendary concierge at a famous European hotel and the lobby boy who becomes his trusted protégé are drawn into a theft, a murder, and a fight over a fortune. Recounted decades later, their story unfolds as a caper as elegant and absurd as the hotel itself.',
  },
  {
    id: 'whiplash',
    title: 'Whiplash',
    posterPath: '/7fn624j5lj3xTme2SgiLCeuedmO.jpg',
    backdropPath: '/7fn624j5lj3xTme2SgiLCeuedmO.jpg',
    year: 2014,
    runtimeMinutes: 107,
    genres: ['Drama', 'Music'],
    rating: 8.3,
    synopsis:
      "A first-year student at a cutthroat music conservatory sets his sights on becoming one of the greats, landing a spot in the studio band led by a conductor whose teaching methods blur the line between mentorship and abuse. Their battle of wills pushes both men toward a performance neither can walk away from unchanged.",
  },
  {
    id: 'coco',
    title: 'Coco',
    posterPath: '/gGEsBPAijhVUFoiNpgZXqRVWJt2.jpg',
    backdropPath: '/gGEsBPAijhVUFoiNpgZXqRVWJt2.jpg',
    year: 2017,
    runtimeMinutes: 105,
    genres: ['Animation', 'Family', 'Fantasy', 'Comedy', 'Music'],
    rating: 8.2,
    synopsis:
      "A boy who dreams of becoming a musician, despite his family's generations-old ban on music, finds himself transported to the vibrant Land of the Dead on the Day of the Dead. To find his way back home, he must uncover the truth behind the ban and the family history that started it.",
  },
  {
    id: 'dark-knight',
    title: 'The Dark Knight',
    posterPath: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    backdropPath: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    year: 2008,
    runtimeMinutes: 152,
    genres: ['Drama', 'Action', 'Crime', 'Thriller'],
    rating: 8.5,
    synopsis:
      "With the mob's grip on the city finally loosening, a vigilante, a crusading district attorney, and a dedicated police lieutenant find their efforts turned against them by a new criminal mastermind who wants nothing but chaos. As the body count rises, each of them is forced to decide exactly how far he is willing to go to save a city that may not deserve saving.",
  },
]
