# Mina zkApp: 01challenge


The smart contract uses merkle tree to store the eligible list of address and the messages.  
The addresses and messages are stored off-chain.  
Only the merkle root is stored on-chain. 

## Explnanation

The following code checks that accounts are on the merkle tree (eligible list).  treeroot is the merkle root.  path is the MerkleWitness.  account contains the address.  The code is in SpyMsg.inputMsg().
```typescript
    path.calculateRoot(account.hash()).assertEquals(treeroot);
```

The following code checks the flags to determine if the flag is valid.  The following code is in SpyMsg.checkMsg()

```typescript
      let bitmap = msg.toBits();
  
      // the bitmap is indexed from right to left.  [0] is at the right. 
      let flag1:Bool = bitmap[0];
      let flag2:Bool = bitmap[1];
      let flag3:Bool = bitmap[2];
      let flag4:Bool = bitmap[3];
      let flag5:Bool = bitmap[4];
      let flag6:Bool = bitmap[5];
  
      let rule1Satisfied:Bool = Provable.if(flag1, 
          flag2.not()
          .and(flag3.not())
          .and(flag4.not())
          .and(flag5.not())
          .and(flag6.not()),
          Bool(true));
  
      let rule2Satisfied:Bool = Provable.if(flag2, flag3, Bool(true));
  
      let rule3Satisfied:Bool = Provable.if(flag4, flag5.not().and(flag6.not()), Bool(true));
```

## Explanations

### A function to store eligible addresses
SpyMsg.initStates(treeroot)

This allows the user to set the Merkle tree root of eligible list. 

### A function to check and store messages
SpyMsg.inputMsg(msg, account, path)

This allows the user to input a message.  The account will be checked to see if it existed on the eligible list.  

### Tests
Tests are in main.ts.



## How to build

```sh
npm run build
```

## How to run tests

```sh
node build/src/main.js
```


## License

[Apache-2.0](LICENSE)
