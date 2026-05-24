import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const LOCALES_DIR = join(process.cwd(), 'frontend', 'src', 'i18n', 'locales')

const trQuiz = {
  pageTitle: "Turnuva",
  pageSubtitle: "En iyisini seç, şampiyonu bul",
  chooseCategory: "Kategori seç",
  resume: "Devam et",
  resumeBadge: "Devam ediliyor · Tur {{round}}",
  startNew: "Yeni turnuva başlat",
  remaining: "{{count}} kaldı",
  round: "Tur {{round}}",
  vsLabel: "vs",
  pickOne: "Hangisi daha iyi?",
  progress: "{{done}} / {{total}} seçildi",
  globalStats: "Kullanıcıların %{{pct}}'i bunu seçti",
  globalStatsFirst: "Bu maçup ilk kez oynandı!",
  resultTitle: "Şampiyon!",
  resultSubtitle: "Bu kategorideki favorin:",
  playAgain: "Yeni turnuva başlat",
  viewHistory: "Geçmiş turnuvalar",
  historyTitle: "Geçmiş turnuvalar",
  historyEmpty: "Henüz tamamlanan turnuvan yok.",
  historyWinner: "Şampiyon: {{title}}",

  filterMovies: "En yüksek puanlı {{count}} film",
  filterTv: "En yüksek puanlı {{count}} dizi",
  filterDocs: "En yüksek puanlı {{count}} belgesel",
  itemsCount: "{{count}} içerik",
  matchesCount: "{{count}} maç",
  resumeHint: "Kaldığın yerden devam et",
  resumeItemsLeft: "Tur {{round}} · {{count}} içerik kaldı",
  startBtn: "🏆 BAŞLA",
  failedLoad: "Kategoriler yüklenemedi.",
  selectFromItems: "{{count}} içerikten seç",
  startTourney: "Turnuvayı başlat →",
  completedMatches: "{{done}}/{{total}} tamamlandı",
  fullRanking: "Tam Sıralama",
  itemsSub: "içerik",
  roundSub: "tur"
}

const enQuiz = {
  pageTitle: "Tournament",
  pageSubtitle: "Choose the best, find the champion",
  chooseCategory: "Choose category",
  resume: "Resume",
  resumeBadge: "In progress · Round {{round}}",
  startNew: "Start new tournament",
  remaining: "{{count}} left",
  round: "Round {{round}}",
  vsLabel: "vs",
  pickOne: "Which is better?",
  progress: "{{done}} / {{total}} picked",
  globalStats: "%{{pct}} of users picked this",
  globalStatsFirst: "First time this matchup is played!",
  resultTitle: "Champion!",
  resultSubtitle: "Your favorite in this category:",
  playAgain: "Start new tournament",
  viewHistory: "Past tournaments",
  historyTitle: "Past tournaments",
  historyEmpty: "You haven't completed any tournaments yet.",
  historyWinner: "Champion: {{title}}",

  filterMovies: "Top {{count}} rated movies",
  filterTv: "Top {{count}} rated TV series",
  filterDocs: "Top {{count}} rated documentaries",
  itemsCount: "{{count}} items",
  matchesCount: "{{count}} matches",
  resumeHint: "Resume where you left off",
  resumeItemsLeft: "Round {{round}} · {{count}} items left",
  startBtn: "🏆 START",
  failedLoad: "Failed to load categories.",
  selectFromItems: "Select from {{count}} items",
  startTourney: "Start tournament →",
  completedMatches: "{{done}}/{{total}} completed",
  fullRanking: "Full Ranking",
  itemsSub: "items",
  roundSub: "round"
}

const files = readdirSync(LOCALES_DIR).filter(f => f.endsWith('.json'))

for (const file of files) {
  const raw = readFileSync(join(LOCALES_DIR, file), 'utf8')
  const obj = JSON.parse(raw)
  
  if (file === 'tr.json') {
    obj.quiz = trQuiz
  } else {
    obj.quiz = enQuiz
  }
  
  writeFileSync(join(LOCALES_DIR, file), JSON.stringify(obj, null, 2) + '\n')
}
console.log("i18n updated")
