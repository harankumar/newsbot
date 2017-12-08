"use strict"

const xml_parser = require('xml2json')
const request = require('request')
const fs = require('fs')
const mkdirp = require('mkdirp')
const scrape = require('scrape-it')
const zlib = require('zlib')
const getStream = require('get-stream')

const SITEMAP_URL_BASE = "https://www.usatoday.com/news-sitemap.xml"; 

const NEWS_DIR = "/home/haran/news" // absolute path

const NOT_NEWS = new Set(JSON.parse(fs.readFileSync("not_news.json")))

const BODY_SPACER = "\n\n   "

const TIMEOUT = 1000*60*20

const MAX_PATH_LENGTH = 150

function parseSitemap(sitemapXML){
  const json = xml_parser.toJson(sitemapXML, {object: true})
  const entries = json["urlset"]["url"].filter(function(entry){
    for (let frag of entry.loc.toLowerCase().split("/")){
      if (NOT_NEWS.has(frag))
        return false
    }
    return true
  })

  // console.log("Parsed Sitemap!")
  entries.forEach(saveNYTArticle)
}

function readNYTarticle(entry, callback){
  setTimeout(function(){
    // console.log("Loading " + entry.loc + "...")
    scrape(entry.loc, {
      author: {
        listItem: "[rel=author]"
      },
      title: "[itemprop=headline]",
      body: {
        listItem: "[itemprop=articleBody] p"
      }
    }).then((article_data) => callback({
      title: article_data.title,
      author: article_data.author.join("; "),
      date: entry.lastmod.split("T")[0],
      text: article_data.body.join(BODY_SPACER),
      url: entry.loc,
      source: "USA Today"
    }))
  }, Math.floor(Math.random() * TIMEOUT))
}

function saveNYTArticle(entry){
  try {
    readNYTarticle(entry, function(article){
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

//for (let i = 7; i <= 9; i++)
//  getStream(request(SITEMAP_URL_BASE + "0" + i + ".xml.gz")
//              .pipe(zlib.createGunzip()))
//    .then(parseSitemap)



// getStream(request(SITEMAP_URL_BASE + 10 + ".xml.gz")
//            .pipe(zlib.createGunzip()))
//  .then(parseSitemap)a
//

request(SITEMAP_URL_BASE)
	.then(parseSitemap)
