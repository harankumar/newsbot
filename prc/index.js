"use strict"

const xml_parser = require('xml2json')
const request = require('request')
const fs = require('fs')
const mkdirp = require('mkdirp')
const scrape = require('scrape-it')
const condense = require('condense-whitespace')

const NEWS_DIR = "/home/haran/news" // absolute path

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

    if (entry.loc.indexOf("2017") === -1 && entry.loc.indexOf("2016") === -1)
      return false

    return true

  })

  console.log("Parsed " + entries.length
            + " entries in Sitemap " + response.request.href)
  entries.forEach(savePRCArticle)
}

function readPRCarticle(entry, callback){
  setTimeout(function(){
    // console.log("Loading " + entry.loc + "...")
    scrape(entry.loc, {
      author: {
        listItem: ".bios p [rel='author']"
      },
      title: ".content h1",
      body: {
        listItem: ".content .text p"
      },
      date: ".content .date"
    }).then((article_data) => callback({
      title: article_data.title,
      author: condense(article_data.author.join("; ")),
      date: (new Date(article_data.date.match(
                /[A-Z][a-z]+ \d{2}\, \d{4}/g)[0])
            ).toISOString().split("T")[0],
      text: article_data.body.join(BODY_SPACER),
      url: entry.loc,
      source: "Pew Research Center"
    }))
  }, Math.floor(Math.random() * TIMEOUT))
}

function savePRCArticle(entry){
  try {
    readPRCarticle(entry, function(article){
      // console.log("Received " + article.title + "...")
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
    console.log("FAILURE " + entry.loc)
  }
}

const SITEMAP = "http://www.pewresearch.org/post_fact-tank.xml"
request(SITEMAP, parseSitemap)
