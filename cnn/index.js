"use strict"

const xml_parser = require('xml2json')
const request = require('request')
const fs = require('fs')
const mkdirp = require('mkdirp')
const scrape = require('scrape-it')

const SITEMAP_URL_BASE = "http://www.cnn.com/sitemaps/sitemap-articles-2017-";

const NEWS_DIR = "/home/haran/news" // absolute path

const NOT_NEWS = new Set([
  "travel",
  "sports",
  "video",
  "entertainment",
  "style",
  "vr",
  "health"
])

const BODY_SPACER = "\n\n   "

const TIMEOUT = 1000*60*20

function parseSitemap(error, response, body){
  if (!body || !response){
    console.log("Error!", error)
    return
  }

  const json = xml_parser.toJson(body, {object: true})
  const entries = json["urlset"]["url"].filter(function(entry){
    for (let frag of entry.loc.split("/")){
      if (NOT_NEWS.has(frag))
        return false
    }
    return true
  })

  console.log("Parsed Sitemap " + response.request.href + ".")
  entries.forEach(saveCNNArticle)
}

function readCNNarticle(entry, callback){
  setTimeout(function(){
    // console.log("Loading " + entry.loc + "...")
    scrape(entry.loc, {
      title: "h1",
      author: ".metadata__byline__author",
      body: {
        listItem: ".zn-body__paragraph"
      }
    }).then((article_data) => callback({
      title: article_data.title,
      author: article_data.author,
      date: entry.lastmod.split("T")[0],
      text: article_data.body.slice(0, -1).join(BODY_SPACER),
      url: entry.loc,
      source: "CNN"
    }))
  }, Math.floor(Math.random() * TIMEOUT))
}

function saveCNNArticle(entry){
  try {
    readCNNarticle(entry, function(article){
      // console.log("Saving " + entry.loc + "...")
      const date_frags = article.date.split("-")
      const path = NEWS_DIR + "/" + date_frags[0]
                            + "/" + date_frags[1]
                            + "/" + date_frags[2] + "/"
      const filename = article.title.replace(/[^\w]+/g, "_") + ".json"

      if (article.title === "" || article.text.indexOf(BODY_SPACER) === -1)
        return console.log("FAILURE " + article.url)
      mkdirp(path, function (err) {
        if (err)
          throw err

        fs.writeFileSync(path + filename, JSON.stringify(article, null, 2))
        console.log("SUCCESS " + article.title)
      })

    })
  } catch (error) {
    console.log("FAILURE " + url)
  }
}

//for (let i = 1; i <= 9; i++)
//  request(SITEMAP_URL_BASE + "0" + i + ".xml", parseSitemap)

// request(SITEMAP_URL_BASE + 10 + ".xml", parseSitemap)  
request(SITEMAP_URL_BASE + 11 + ".xml", parseSitemap)  
request(SITEMAP_URL_BASE + 12 + ".xml", parseSitemap)  
