const mongoose = require("mongoose");

db = (async()=>{


try {
    await mongoose.connect('mongodb+srv://meenadeepraj1:C5m51euSIb409kL8@cluster0.igu9hrl.mongodb.net/?retryWrites=true&w=majority');
  } catch (error) {
    handleError(error);
  }
})

module.export = db;

