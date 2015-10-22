Posts = new Mongo.Collection('posts');

Posts.allow({
	update: function(userId, post) { return ownsDocument(userId, post)},
	remove: function(userId, post) { return ownsDocument(userId, post)}
});

Posts.deny({
	update: function(userId, post, fieldNames) {
		return (_.without(fieldNames, 'url', 'title').length > 0);
	}
});

Posts.deny({
	update: function(userId, post, fieldNames, modifier) {
		var errors = validatePost(modifier.$set);
		return errors.title || errors.url;
	}		
});
/*Posts.allow({
	insert: function(userId, doc) {
		return !!userId;
	}		
});*/

validatePost = function (post) {
	var errors = {};

	if (!post.title)
		errors.title = "please input the title";
	
	
	if (!post.url)
		errors.url = "please input the URL";

	return errors;
} 

Meteor.methods({
	postInsert: function(postAttributes) {
		check(this.userId, String);
		check(postAttributes, {
			title: String,
			url: String
		});

		/*if (Meteor.isServer) {
			postAttributes.title += "(server)";
			Meteor._sleepForMs(5000);
		} else {
			postAttributes.title += "(client)";
		}*/
		var errors = validatePost(postAttributes);
		if (errors.title || errors.url)
			throw new Meteor.Error('invalid-post', "You must first input title and URL");

		var postWithSameLink = Posts.findOne({url: postAttributes.url});
		if (postWithSameLink) {
			return {
				postExists: true,
				_id: postWithSameLink._id
			};
		}

		var user = Meteor.user();
		var post = _.extend(postAttributes, {
			userId: user._id,
			author: user.username,
			submitted: new Date(),
			commentsCount: 0,
			upvoters: [],
			votes: 0
		});

		var postId = Posts.insert(post);

		return {
			_id: postId
		};
	},
	
	upvote: function(postId) {
		check(this.userId, String);
		check(postId, String);

		var post = Posts.findOne(postId);
		if (!post) 
			throw new Meteor.Error('invalid', 'Post not found');

		if (_.include(post.upvoters, this.userId))
			throw new Meteor.Error('invalid', 'Already upvoted this post');

		Posts.update(post._id, {
			$addToSet: {upvoters: this.userId},
			$inc: {votes: 1}
		});
	}
});
