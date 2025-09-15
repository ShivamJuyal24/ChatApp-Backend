import Message from "../models/message.model.js";


//create messsage
export const createMessage = async ( req, res) =>{
    try{
        const sender = req.user._id;
        const { receiver, content} = req.body;
         
        if(!receiver || !content){
            return res.status(400).json({ message : "Receiver and content are required."});
        }

        if(sender.toString() === receiver){
            return res.status(400).json({ message: " Cannot send message to yourself."});
        }

        const message = await Message.create({
            sender,
            receiver,
            content
        });

        res.status(201).json(message);
    }catch(error){
        console.error("Error creating message :", error);
        res.status(500).json({ message : "Server error !!"});
        
    }
};

//Get message between two users
export const getMessage = async ( req, res) =>{
    try{
        const userId = req.user._id.toString();
        const { user1, user2} = req.params;

        // Authorize
        if(![user1, user2].includes(userId)){
            return res.status(403).json({ message: " Not authorize to view this conversation."})
        }

        const messages = await Message.find({
            $or:[
                { sender: user1, receiver: user2 },
                { sender: user2, receiver: user1 }
            ]
        }).sort({createdAt : 1});

        res.json(messages);
    }catch(error){
        console.error("Error fetching messages:", error);
        res.status(500).json({message : "Server error."});
        
    }
};