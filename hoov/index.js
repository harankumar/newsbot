"use strict"

const xml_parser = require('xml2json')
const request = require('request')
const fs = require('fs')
const mkdirp = require('mkdirp')
const scrape = require('scrape-it')
const condense = require('condense-whitespace')

const NEWS_DIR = "/home/haran/news" // absolute path

const NOT_NEWS = new Set(JSON.parse(fs.readFileSync("not_news.json")))
const INCLUDES = new Set(JSON.parse(fs.readFileSync("includes.json")))

const BODY_SPACER = "\n\n   "

const TIMEOUT = 1000*60*30

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

    if ((! entry.lastmod)
        || (entry.lastmod.indexOf("2017") === -1
            && entry.lastmod.indexOf("2016") === -1))
      return false

    for (let frag of entry.loc.split("/")){
      if (NOT_NEWS.has(frag))
        return false
    }

    for (let frag of entry.loc.split("/")){
      if (INCLUDES.has(frag))
        return true
    }

    return false

  })

  console.log("Parsed " + entries.length
            + " entries in Sitemap " + response.request.href)
  entries.forEach(saveHOOVArticle)
}

function readHOOVarticle(entry, callback){
  setTimeout(function(){
    // console.log("Loading " + entry.loc + "...")
    scrape(entry.loc, {
      author: ".article-header .field-name-field-research-authors.field-meta",
      title: "h1.page-title",
      body: {
        listItem: ".field-name-body .field-items .field-item p, .field-name-body .field-items .field-item div"
      },
      date: ".field-meta .date-display-single"
    }).then((article_data) =>
      callback({
        title: article_data.title,
        author: condense(article_data.author),
        date: (new Date(article_data.date)).toISOString().split("T")[0],
        text: article_data.body.join(BODY_SPACER),
        url: entry.loc,
        source: "Hoover Institution"
      })
    )
  }, Math.floor(Math.random() * TIMEOUT))
}

function saveHOOVArticle(entry){
  try {
    readHOOVarticle(entry, function(article){
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


const SITEMAP_BASE_URL = "http://www.hoover.org/sitemap.xml?page="
for (let i = 1; i <= 3; i++)
  request(SITEMAP_BASE_URL + i, parseSitemap)
