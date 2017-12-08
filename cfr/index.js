"use strict"

const xml_parser = require('xml2json')
const request = require('request')
const fs = require('fs')
const mkdirp = require('mkdirp')
const scrape = require('scrape-it')
const condense = require('condense-whitespace')

const NEWS_DIR = "/home/haran/news" // absolute path

const NOT_NEWS = new Set(JSON.parse(fs.readFileSync("not_news.json")))

const BODY_SPACER = "\n\n   "

const TIMEOUT = 1000*60*120

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

    if (!(entry.lastmod))
      return false

    for (let frag of entry.loc.split("/")){
      if (NOT_NEWS.has(frag))
        return false
    }
    return true

  })

  console.log("Parsed " + entries.length
            + " entries in Sitemap " + response.request.href)
  entries.forEach(saveCFRArticle)
}

function readCFRarticle(entry, callback){
  setTimeout(function(){
    // console.log("Loading " + entry.loc + "...")
    scrape(entry.loc, {
      author: "p.article-header__byline",
      title: "h1.article-header__title",
      body: {
        listItem: ".body-content p"
      },
      date: ".article-header__date-ttr"
    }).then((article_data) => callback({
      title: article_data.title,
      author: condense(article_data.author),
      date: (new Date(article_data.date.match(
                /[A-Z][a-z]+ \d{2}\, \d{4}/g)[0])
            ).toISOString().split("T")[0],
      text: article_data.body.join(BODY_SPACER),
      url: entry.loc,
      source: "Council on Foreign Relations"
    }))
  }, Math.floor(Math.random() * TIMEOUT))
}

function saveCFRArticle(entry){
  try {
    readCFRarticle(entry, function(article){
      // console.log("Received " + article.title + "...")
      if (article.title === "" || article.text.indexOf(BODY_SPACER) === -1)
        return console.log("FAILURE " + article.url)

      if (article.date.indexOf("2017") === -1
          && article.date.indexOf("2016") === -1)
        return console.log("OUTDATED " + article.url)

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

const SITEMAP_BASE_URL = "https://www.cfr.org/sitemaps/"
for (let i = 1; i <= 21; i++)
  request(SITEMAP_BASE_URL + i + "/sitemap.xml", parseSitemap)
