add support for "research" material manifest generation
please for the love of god write testing. why wont you do this.

I dont want to check in the testing html files from internet sources, so here
$ wget https://www.imdb.com/title/tt6806448/
  or
$ curl https://www.imdb.com/title/tt6806448/ --output crap.html

node index.js --method=metadata --debug=true --data='{"dirs":["/home/<username>/projects/manifest/test_files"],"update":true,"source":"imdb"}'

node index.js --method=manifest --debug=true --data='{"dirs":["/home/<username>/projects/manifest/test_files"],"type":"pdf_media","source":"imdb"}'

scraper working, need to add lotso logs and test more than 1 json file

manifest formats:
  pdf:
  html:

manifest generation types:
  media:
    generate a pdf report with all the info you can possibly add

  media_names:
    generate a pdf of cataloged media(info.json present) names only

  index:
    log every file, its size, locations, etc
Functions:
  - Generate pdf files from the result of reading files on disk
  - Scrape web to populate info for content on disks
    This method requires the info.json with url property populated before hand.
    We scrape every directory for its url(mal, imdb), hit said URL to fetch all
    the info we can.

    Obviously the manifest for this info will be more detailed than the general
    manifest runs.

TODO:
  handle multiple directories during scrape,manifest generate, everything
  check if scraped image is valid(imageSize?)
    turns out that some of the images threw redirects and the request lib we
    created did not support redirects. added support but the issue is still
    occurring(I did not test if that fixed it lol). even if we just check if its
    broken and throw a log, thats better than nothing.

You can simple run manifest against a disk/directory and it will generate a
navigatable file tree result, like treesizefree on windows

Get more detailed information by adding a (hidden?)json file in the root of a
directory that is the parent of all the objects in it(IE, all content inside of
Something Season 1 folder belongs to it).
File Structure Example:
/Something Season 1
  /metadata
    /cover.jpg
    /trailer_0.mp4
  /episode_1.mkv
  /episode_2.mkv
  /info.json

info.json contains properties:
  - title
  - description
  - dateAired
  - url

metadata folder contains visual content

new info.json structure

{
  schemaVersion: 2,
  sources: {
    imdb: {
      url: '',
      updatedDate: '',
      version: 0
    }
  },
  data: {
    "imdb_0": {
      date: '',
      title: '',
      description: '',
      coverImage: 'cover_0.jpg'
    },
    "imdb_1": {
      date: '',
      title: '',
      description: '',
      coverImage: 'cover_1.jpg'
    }
  }
}

this structure means we no longer overwrite, we only append(per say). cover
images will no longer be overwritten this way now. the call to fetch manifests
will look like

$ node index.js --method=metadata --debug=true --data='{"dirs":["/home/<username>/projects/manifest/test_files"],"source":"imdb"}'

before writing info.json to disk, we will create info_bak.json of the one on
disk then write the current to info.json

# NOTES
tables
http://pdfkit.org
https://github.com/foliojs/pdfkit/issues/29
https://www.andronio.me/2017/09/02/pdfkit-tables/
