"use strict"

const xml_parser = require('xml2json')
const request = require('request')
const fs = require('fs')
const mkdirp = require('mkdirp')
const scrape = require('scrape-it')
const zlib = require('zlib')
const getStream = require('get-stream')

const NEWS_DIR = "/home/haran/news" // absolute path

const INCLUDES = new Set(JSON.parse(fs.readFileSync("includes.json")))

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

    if (!(entry.lastmod)
        || (entry.lastmod.indexOf("2017") === -1))
      return false

    for (let frag of entry.loc.split("/")){
      if (INCLUDES.has(frag))
        return true
    }

    return false
  })

  console.log("Parsed " + entries.length
            + " entries in Sitemap " + response.request.href)
  entries.forEach(saveECONArticle)
}

function readECONarticle(entry, callback){
  setTimeout(function(){
    // console.log("Loading " + entry.loc + "...")
    getStream(request(entry.loc)
                .pipe(zlib.createGunzip()))
    .then(
      (text) => {
        const article_data = scrape.scrapeHTML(text, {
          title: ".main-content__clearfix h1 .flytitle-and-title__title",
          body: {
            listItem: ".blog-post__text p"
          },
          date: {
            selector: ".blog-post__datetime",
            attr: "datetime"
          }
        })

        callback({
          title: article_data.title,
          author: "The Economist",
          date: article_data.date.split("T")[0],
          text: article_data.body.join(BODY_SPACER),
          url: entry.loc,
          source: "The Economist"
        })
    })
  }, Math.floor(Math.random() * TIMEOUT))
}


function saveECONArticle(entry){
  try {
    readECONarticle(entry, function(article){
      // console.log(article)

      if (article.title === "" || article.text.indexOf(BODY_SPACER) === -1)
        return console.log("FAILURE " + article.url)

      if (article.date.indexOf("2017") === -1)
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

const SITEMAP_URL_BASE = "http://www.economist.com/sitemap.xml?page="
for (let i = 1; i <= 2; i++)
  request(SITEMAP_URL_BASE + i, parseSitemap)
