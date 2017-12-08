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

    // Going back in to get the slightly outdated articles
    if (!(entry.lastmod) || entry.lastmod.indexOf("2016") === -1)
      return false

    for (let frag of entry.loc.split("/")){
      if (NOT_NEWS.has(frag))
        return false
    }
    return true

  })

  console.log("Parsed " + entries.length
            + " entries in Sitemap " + response.request.href)
  entries.forEach(saveCATOArticle)
}

function readCATOarticle(entry, callback){
  setTimeout(function(){
    // console.log("Loading " + entry.loc + "...")
    scrape(entry.loc, {
      author: "div#pub-authors",
      title: "h1.page-h1",
      body: {
        listItem: "article p"
      }
    }).then((article_data) => callback({
      title: article_data.title,
      author: article_data.author,
      date: entry.lastmod.split("T")[0],
      text: article_data.body.join(BODY_SPACER),
      url: entry.loc,
      source: "Cato Institute"
    }))
  }, Math.floor(Math.random() * TIMEOUT))
}

function saveCATOArticle(entry){
  try {
    readCATOarticle(entry, function(article){
      if (article.title === "" || article.text.indexOf(BODY_SPACER) === -1)
        return console.log("FAILURE " + url)

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

const SITEMAP_BASE_URL = "https://www.cato.org/sitemap.xml?page="
for (let i = 1; i <= 2; i++)
  request(SITEMAP_BASE_URL + i, parseSitemap)
