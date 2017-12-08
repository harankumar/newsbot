"use strict"

const xml_parser = require('xml2json')
const request = require('request')
const fs = require('fs')
const mkdirp = require('mkdirp')
const scrape = require('scrape-it')

const NEWS_DIR = "/home/haran/news" // absolute path

const NOT_NEWS = new Set(JSON.parse(fs.readFileSync("not_news.json")))

const BODY_SPACER = "\n\n   "

const TIMEOUT = 1000*60*20

const MAX_PATH_LENGTH = 150

function parseSitemap(error, response, body){
  if (!body || !response){
    console.log("Error!", error)
    return
  }

  const json = xml_parser.toJson(body, {object: true})

  const entries = json["urlset"]["url"].filter(function(entry){
    if ((!entry.loc) || (typeof entry.loc !== "string"))
      return false

    for (let frag of entry.loc.split("/")){
      if (NOT_NEWS.has(frag))
        return false
    }
    return true
  })

  console.log("Parsed " + entries.length
            + " entries in Sitemap " + response.request.href)
  entries.forEach(saveAJZArticle)
}

function readAJZarticle(entry, callback){
  setTimeout(function(){
    // console.log("Loading " + entry.loc + "...")
    scrape(entry.loc, {
      author: "h5[role='author']",
      title: "article h1",
      body: {
        listItem: "#jtarticle p"
      }
    }).then((article_data) => callback({
      title: article_data.title,
      author: article_data.author
        || (entry.loc.indexOf("editorials") !== -1 ? "Editorial" : ""),
      date: entry.lastmod.split("T")[0],
      text: article_data.body.join(BODY_SPACER),
      url: entry.loc,
      source: "Japan Times"
    }))
  }, Math.floor(Math.random() * TIMEOUT))
}

function saveAJZArticle(entry){
  try {
    readAJZarticle(entry, function(article){
      if (article.title === "" || article.text.indexOf(BODY_SPACER) === -1)
        return console.log("FAILURE " + article.url)

      // console.log("Saving " + entry.loc + "...")
      const date_frags = article.date.split("-")
      const path = NEWS_DIR + "/" + date_frags[0]
                            + "/" + date_frags[1]
                            + "/" + date_frags[2] + "/"
      const filename = article.title.replace(/[^\w]+/g, "_")
      const full_path = (path + filename).slice(0, MAX_PATH_LENGTH) + ".json"

      mkdirp(path, function (err) {
        if (err)
          throw err

        fs.writeFileSync(full_path, JSON.stringify(article, null, 2))
        console.log("SUCCESS " + article.title)
      })

    })
  } catch (error) {
    console.log("FAILURE " + url)
  }
}

const SITEMAP_URL_BASE_NEWS = "http://www.japantimes.co.jp/news-sitemap"
for (let i = 140; i <= 147; i++)
  request(SITEMAP_URL_BASE_NEWS + i + ".xml", parseSitemap)

const SITEMAP_URL_BASE_OPINION = "http://www.japantimes.co.jp/opinion-sitemap"
for (let i = 28; i <= 29; i++)
  request(SITEMAP_URL_BASE_OPINION + i + ".xml", parseSitemap)
