"use strict"

const xml_parser = require('xml2json')
const request = require('request')
const fs = require('fs')
const mkdirp = require('mkdirp')
const scrape = require('scrape-it')

const NEWS_DIR = "/home/haran/news" // absolute path

const NOT_NEWS = new Set(JSON.parse(fs.readFileSync("not_news.json")))

const BODY_SPACER = "\n\n   "

const TIMEOUT = 1000*60*40

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
  entries.forEach(saveCSMArticle)
}

function readCSMarticle(entry, callback){
  setTimeout(function(){
    // console.log("Loading " + entry.loc + "...")
    scrape(entry.loc, {
      author: {
        listItem: "li.author-container"
      },
      title: "#headline",
      body: {
        listItem: "div.eza-body p"
      },
      date: {
        selector: "time#date-published"
      }
    }).then((article_data) => callback({
      title: article_data.title,
      author: article_data.author.join("; "),
      date: (new Date(article_data.date)).toISOString().split("T")[0],
      text: article_data.body.join(BODY_SPACER),
      url: entry.loc,
      source: "The Christian Science Monitor"
    }))
  }, Math.floor(Math.random() * TIMEOUT))
}

function saveCSMArticle(entry){
  try {
    readCSMarticle(entry, function(article){
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

const SITEMAP_URL = "https://www.csmonitor.com/sitemap-2017-auto-1.xml"
const SITEMAP_URL_ = "https://www.csmonitor.com/sitemap-news-auto-1.xml"
request(SITEMAP_URL, parseSitemap)
request(SITEMAP_URL_, parseSitemap)
