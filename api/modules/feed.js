import Feed from '../models/feed'
import Beer from '../models/beer'
import Pub from '../models/pub'
import User from '../models/user'


function _appendFeedPager (models, query) {
  if (!query.type || query.type !== 'all') {
    const page = (!query.page || query.page <= 0)
      ? 1 : query.page
    const count = (!query.count || query.count <= 0)
      ? 20 : query.count
    return models.limit(Number(count)).skip((page-1) * count)
  }
  return models
}


async function _appendFeedExecuter (models, popArray) {
  return await models.populate(popArray)
    .exec((err, feeds) => {
    if (err) {
      return null
    }
    return feeds
  })
}


async function _appendFeedCounter (models, query) {
  const count = await Feed.count({}, (err, count) => {
    return count
  })

  const totalPage = parseInt(count / (query.count || 20)) <= 0 ?
    0 : parseInt(count / (query.count || 20))
  const lastPage = parseInt(count % (query.count || 20)) <= 0 ?
    0 : 1

  return {
    feedList: models,
    currentPage: query.page || 1,
    totalPage: totalPage + lastPage
  }
}


export async function getFeedList (req) {
  const findFeeds = _appendFeedPager(Feed.find({is_ok: 1})
    .sort({crt_dt: -1}), req.query)
  const feeds = await _appendFeedExecuter(findFeeds, ['beers', 'pub', 'user'])
  return await _appendFeedCounter(feeds, req.query)
}


export async function getPubFeedList (pub_id, req) {
  const findFeeds = _appendFeedPager(Feed.find({is_ok: 1, pub: pub_id})
    .sort({crt_dt: -1}), req.query)
  const feeds = await _appendFeedExecuter(findFeeds, ['beers', 'pub', 'user'])
  return await _appendFeedCounter(feeds, req.query)
}


export async function getBeerFeedList (beer_id, req) {
  const findFeeds = _appendFeedPager(Feed.find({is_ok: 1, beers: beer_id })
    .sort({crt_dt: -1}), req.query)
  const feeds = await _appendFeedExecuter(findFeeds, ['beers', 'pub', 'user'])
  return await _appendFeedCounter(feeds, req.query)
}


/**
  NOTE: 피드 저장 (저장 전에 이미지들 부터 저장 후 진행)
**/
export async function insertFeed (req) {
  let newFeed = new Feed()
  newFeed.beers = await Beer.find({is_ok: 1, _id: {
    $in: req.body.beer_ids
  }}).exec((err, beers) => {
    if (err) {
      return null
    }
    return beers
  })
  newFeed.pub = await Pub.findOne({is_ok: 1,
    _id: req.body.pub_id}).exec((err, pub) => {
    if (err) {
      return null
    }
    return pub
  })
  newFeed.user = await User.findOne({is_ok: 1, _id: req.body._id})
    .exec((err, user) => {
    if (err) {
      return null
    }
    return user
  })
  newFeed.context = req.body.context || ''
  newFeed.is_ok = 1
  newFeed.crt_dt = new Date()
  newFeed.udt_dt = newFeed.crt_dt
  newFeed.image = `feeds/${req.file.filename}`

  if (newFeed.beers === null
    || newFeed.pub === null
    || newFeed.user === null
    || newFeed.context === null
    || newFeed.image === null) {
    return null
  }

  const savedFeed = await newFeed.save((err, savedFeed) => {
    if (err) {
      return null
    }
    return savedFeed
  })

  return Feed.populate(savedFeed, ['beers', 'pub', 'user'], (err, feed) => {
    if (err) {
      return null
    }
    return feed
  })
}


/**
  NOTE: 피드 수정
  TODO: (저장 전에 기존 이미지들 및 레퍼런스 삭제)
**/
export async function updateFeed (req) {
  const feed_id = req.params.feed_id

  let datas = {
    udt_dt: new Date(),
    context: req.body.context || '',
    beers: await Beer.find({is_ok: 1, _id: {
      $in: req.body.beer_ids
    }}).exec((err, beers) => {
      if (err) {
        return null
      }
      return beers
    }),
    pub: await Pub.findOne({is_ok: 1,
      _id: req.body.pub_id}).exec((err, pub) => {
      if (err) {
        return null
      }
      return pub
    }),
    user: await User.findOne({is_ok: 1, _id: req.body._id})
      .exec((err, user) => {
      if (err) {
        return null
      }
      return user
    }),
  }

  if (req.file && req.file.fieldname === 'feedImage') {
    datas.image = `feeds/${req.file.filename}`
  }

  await Feed.updateOne({_id: feed_id}, datas).exec(async (err, feed) => {
    if (err) {
      return null
    }
    return feed
  })

  return await Feed.findOne({is_ok: 1, _id: feed_id})
    .populate(['beers', 'pub', 'user']).exec((err, feed) => {
    if (err) {
      return null
    }
    return feed
  })
}


/**
  NOTE: 피드 삭제 (삭제 전에 기존 이미지들 및 레퍼런스 삭제)
**/
export async function deleteFeed (feed_id) {
  return await Feed.updateOne({_id: feed_id}, {is_ok: 0, udt_dt: new Date()})
    .exec((err, feed) => {
    if (err) {
      return null
    }
    return feed
  })
}
