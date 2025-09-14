import Message from '../models/message.model.js';

//Create Message
export const createMessage = async (req, res)=>{
  try{
    const {sender, receiver, content} = req.body;
    const message = await Message.create({
        sender, receiver, content
    })
   res.status(201).json(message);
  }catch(error){
    res.status(500).json({
        message: " Server Error"
    })
  }
};

//Get Messages
export const getMessage = async (req, res) =>{
    try{
        const { user1, user2}= req.params;
      const messages = await Message.find({
            $or:[
                {sender: user1, receiver: user2},
                {sender: user2, receiver:user1}
            ],
        }).sort({createdAt: 1});
        res.json(messages);
    }catch(error){
        res.status(500).json({ error: error.message})
    }
}

