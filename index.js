require("dotenv").config();
require("./db/db");
const ethers = require("ethers");
const abi = require("./abi.json");
const ProductModel = require("./db/Models/Product");
const RandomNumbersModel = require("./db/Models/RandomNumbers");
const ChatModel = require("./db/Models/Chat");


const main = async () => {
  const address = "0xA82b4B9355B91Fb28376cb2917c72437f0E8c88e";
  const provider = new ethers.providers.WebSocketProvider(
    `wss://polygon-mumbai.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`
  );
  const contract = new ethers.Contract(address, abi, provider);
  console.log("Watcher is running...");
  contract.on(
    "nftMinted",
    async (tokenId, name, price, owner, image, category, flag) => {
      console.log(`New NFT emmited tokenId: ${tokenId}`);
      try {
        const product = new ProductModel({
          tokenId,
          name,
          price,
          owner,
          image,
          category,
          flag,
        });

        await product.save();
        console.log("NFT Created on MongoDB");
      } catch (e) {
        console.log("---------------------- Error ------------------------");
        console.log(e);
      }
    }
  );

  contract.on("RequestedRandomness", async (requestId, from, to, objectId) => {
    console.log(`New Random Number emmited requestId: ${requestId} , tokenId: ${objectId}`);
    try {
      const randomNumber = new RandomNumbersModel({
        requestId,
        from,
        to,
        objectId,
        status: "Pending for Pay",
      });

      await randomNumber.save();
      console.log("Random number Created on MongoDb");
    } catch (e) {
      console.log("---------------------- Error ------------------------");
      console.log(e);
    }
  });

  contract.on("makeDeposit", async (objectId) => {
    console.log(`New deposit emmited objectId: ${objectId}`);
    try {
      const randomNumber = await RandomNumbersModel.findByIdAndUpdate(
        objectId,
        { status: "Pending for deliver" }
      );
      console.log("Random number Update deposit on Mongo");
    } catch (e) {
      console.log("---------------------- Error ------------------------");
      console.log(e);
    }
  });

  contract.on("withdraw", async (objectId, result) => {
    console.log(`New withdraw emmited objectId: ${objectId}`);
    try {
      const randomNumber = await RandomNumbersModel.findByIdAndUpdate(
        objectId,
        { status: result ? "Sold successfully" : "Refund" }
      );
      if(result){
        const product = await ProductModel.findOneAndUpdate(
          {tokenId: randomNumber.objectId},
          {
            owner: randomNumber.to
          }
        )
        const chat = await ChatModel.findOne({
          owner: randomNumber.from,
          buyer: randomNumber.to,
          tokenId: randomNumber.objectId 
        })
        if(chat){
          chat.owner = randomNumber.to;
          chat.buyer = randomNumber.from;
          await chat.save();
        }
      }
      console.log("Random number Updated on MongoDb");
    } catch (e) {
      console.log("---------------------- Error ------------------------");
      console.log(e);
    }
  });
};

main();
