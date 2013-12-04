Meteor.methods({
  bar: function (arg1, arg2) {
    console.log("client.methods.bar");
    var msgs = Session.get('messages');
    msgs.push(arg1);
    Session.set('messages', msgs);
    return "client.methods.bar";
  }
});
