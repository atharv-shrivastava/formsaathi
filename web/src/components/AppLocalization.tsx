import { useEffect, useRef, useState, type ReactNode } from "react";

type Locale = "en" | "hi";

const hindiTranslations: Record<string, string> = {
  "Overview": "अवलोकन",
  "Your documents and information, in one place.": "आपके दस्तावेज़ और जानकारी, एक ही जगह।",
  "My documents": "मेरे दस्तावेज़",
  "Upload, organise and process the documents you choose.": "अपने चुने हुए दस्तावेज़ अपलोड करें, व्यवस्थित करें और प्रोसेस करें।",
  "Information profile": "जानकारी प्रोफ़ाइल",
  "Review extracted information before it is saved as verified.": "निकाली गई जानकारी को सत्यापित करके सहेजने से पहले जाँचें।",
  "Applications": "आवेदन",
  "Keep track of the forms you are working on.": "जिन फ़ॉर्म पर आप काम कर रहे हैं, उनकी प्रगति देखें।",
  "Scan paper form": "फ़ॉर्म स्कैन करें",
  "Scan a paper form": "कागज़ी फ़ॉर्म स्कैन करें",
  "Use your phone camera or gallery to create a filled copy of a paper form.": "फ़ॉर्म की भरी हुई कॉपी बनाने के लिए फ़ोन कैमरा या गैलरी का उपयोग करें।",
  "Browser extension": "ब्राउज़र एक्सटेंशन",
  "Install Saral Form in Chrome and connect it to your reviewed profile.": "Chrome में Saral Form इंस्टॉल करें और इसे अपनी जाँची हुई प्रोफ़ाइल से जोड़ें।",
  "Privacy centre": "गोपनीयता केंद्र",
  "See how your information is stored and control your data.": "जानें कि आपकी जानकारी कैसे रखी जाती है और अपने डेटा को नियंत्रित करें।",
  "Identity": "पहचान",
  "Address": "पता",
  "Income": "आय",
  "Education": "शिक्षा",
  "Bank": "बैंक",
  "Photograph": "फ़ोटो",
  "Signature": "हस्ताक्षर",
  "Other": "अन्य",
  "Applicant name": "आवेदक का नाम",
  "Father / guardian name": "पिता / अभिभावक का नाम",
  "Date of birth": "जन्म तिथि",
  "Annual income": "वार्षिक आय",
  "Marks percentage": "अंकों का प्रतिशत",
  "Bank account number": "बैंक खाता संख्या",
  "IFSC code": "IFSC कोड",
  "Something went wrong. Please try again.": "कुछ गड़बड़ हुई। कृपया दोबारा कोशिश करें।",
  "Opening your workspace…": "आपका वर्कस्पेस खुल रहा है…",
  "First-time setup": "पहली बार सेटअप",
  "Connect your Supabase project.": "अपना Supabase प्रोजेक्ट कनेक्ट करें।",
  "The web app is ready, but it needs your project URL and publishable key before accounts and private storage can work.": "वेब ऐप तैयार है, लेकिन अकाउंट और निजी स्टोरेज चालू करने के लिए प्रोजेक्ट URL और पब्लिशेबल की ज़रूरी है।",
  "Create a Supabase project.": "एक Supabase प्रोजेक्ट बनाएँ।",
  "Project URL": "प्रोजेक्ट URL",
  "Publishable key": "पब्लिशेबल की",
  "from Project Settings → API Keys.": "Project Settings → API Keys से।",
  "and fill in those two values.": "और ये दोनों मान भरें।",
  "using the Supabase SQL Editor.": "Supabase SQL Editor का उपयोग करके।",
  "to Auth → URL Configuration.": "Auth → URL Configuration में जोड़ें।",
  "Keep the service-role key private.": "Service-role key को निजी रखें।",
  "The browser app must use only the publishable key. Never put a Supabase secret or service-role key in a Vite environment variable.": "ब्राउज़र ऐप में केवल publishable key का उपयोग करें। Supabase secret या service-role key को कभी भी Vite environment variable में न रखें।",
  "Account created. Check your email to confirm the address, then sign in.": "अकाउंट बन गया है। ईमेल में पता सत्यापित करें, फिर साइन इन करें।",
  "Your account is ready.": "आपका अकाउंट तैयार है।",
  "From documents": "दस्तावेज़ों से",
  "to done.": "काम पूरा होने तक।",
  "Your documents. Your forms. One clear flow.": "आपके दस्तावेज़। आपके फ़ॉर्म। एक आसान प्रक्रिया।",
  "Paperwork, without the maze.": "बिना उलझन के कागज़ी काम।",
  "Keep documents organised, review extracted details and complete supported forms with control. Saral Form helps with the busywork, while every important decision stays yours.": "दस्तावेज़ व्यवस्थित रखें, निकाली गई जानकारी जाँचें और उपलब्ध फ़ॉर्म अपने नियंत्रण में भरें। Saral Form दोहराए जाने वाले काम में मदद करता है, जबकि हर ज़रूरी निर्णय आपका रहता है।",
  "Your documents stay under your account.": "आपके दस्तावेज़ आपके अकाउंट में ही रहते हैं।",
  "Review extracted details before saving.": "जानकारी सहेजने से पहले उसे जाँचें।",
  "You approve what gets autofilled.": "ऑटोफ़िल होने वाली जानकारी को आप मंज़ूरी देते हैं।",
  "A calmer way to organise documents and complete applications.": "दस्तावेज़ व्यवस्थित करने और आवेदन पूरे करने का एक आसान तरीका।",
  "Create an account": "नया अकाउंट बनाएँ",
  "Welcome back": "वापसी पर स्वागत है",
  "Create your account": "अपना अकाउंट बनाएँ",
  "Sign in to Saral Form": "Saral Form में साइन इन करें",
  "Your personal workspace starts here.": "आपका निजी वर्कस्पेस यहाँ से शुरू होता है।",
  "Pick up where you left off.": "जहाँ छोड़ा था, वहीं से शुरू करें।",
  "Full name": "पूरा नाम",
  "Enter your name": "अपना नाम दर्ज करें",
  "Email address": "ईमेल पता",
  "Password": "पासवर्ड",
  "At least 8 characters": "कम से कम 8 अक्षर",
  "Please wait…": "कृपया प्रतीक्षा करें…",
  "Create account": "अकाउंट बनाएँ",
  "Sign in": "साइन इन",
  "Already have an account?": "पहले से अकाउंट है?",
  "New to Saral Form?": "Saral Form पर नए हैं?",
  "Private account access. Never share your password or verification codes.": "निजी अकाउंट एक्सेस। अपना पासवर्ड या सत्यापन कोड किसी से साझा न करें।",
  "Confirm the private cloud storage notice before uploading a document.": "दस्तावेज़ अपलोड करने से पहले निजी क्लाउड स्टोरेज की सूचना स्वीकार करें।",
  "Choose a PDF, JPG, PNG or WebP file.": "PDF, JPG, PNG या WebP फ़ाइल चुनें।",
  "The MVP upload limit is 10 MB per file.": "इस MVP में हर फ़ाइल की अधिकतम सीमा 10 MB है।",
  "Document category updated.": "दस्तावेज़ की श्रेणी अपडेट हो गई।",
  "Delete": "हटाएँ",
  "and its extracted facts?": "और उससे निकाली गई जानकारी भी?",
  "Document and its extracted facts were deleted.": "दस्तावेज़ और उससे निकाली गई जानकारी हटा दी गई।",
  "Could not download this document from private storage.": "निजी स्टोरेज से यह दस्तावेज़ डाउनलोड नहीं हो सका।",
  "Your sign-in session has expired. Sign in again and retry.": "आपका साइन-इन सत्र समाप्त हो गया है। दोबारा साइन इन करके कोशिश करें।",
  "Check the backend route and Render logs.": "बैकएंड रूट और Render लॉग जाँचें।",
  "AI detected": "AI ने पहचाने",
  "OCR detected": "OCR ने पहचाने",
  "new field(s)": "नए फ़ील्ड",
  "in this document": "इस दस्तावेज़ में",
  ". Select the values you want to save to your profile.": "। अपनी प्रोफ़ाइल में सहेजने वाले मान चुनें।",
  "Extraction finished. Existing approved or dismissed values were kept; no new candidates need review.": "जानकारी निकालना पूरा हुआ। पहले से मंज़ूर या हटाए गए मान वैसे ही रखे गए हैं; जाँच के लिए कोई नया मान नहीं है।",
  "OCR completed, but no fields were confidently detected. Review the original document or enter the information manually.": "OCR पूरा हुआ, लेकिन किसी फ़ील्ड की भरोसेमंद पहचान नहीं हुई। मूल दस्तावेज़ जाँचें या जानकारी स्वयं भरें।",
  "Could not reach the OCR service. It may be starting up; check your connection and retry.": "OCR सेवा से संपर्क नहीं हो सका। हो सकता है सेवा शुरू हो रही हो; इंटरनेट कनेक्शन जाँचकर फिर कोशिश करें।",
  "Approved and saved": "मंज़ूर करके सहेजा गया",
  "to your general profile.": "आपकी सामान्य प्रोफ़ाइल में।",
  "as document-specific information. It stays attached to this document.": "दस्तावेज़-विशिष्ट जानकारी के रूप में। यह इसी दस्तावेज़ से जुड़ी रहेगी।",
  "You selected different values for the same general profile field:": "आपने सामान्य प्रोफ़ाइल के एक ही फ़ील्ड के लिए अलग-अलग मान चुने हैं:",
  ". Choose one value for each general field. Different document-specific values can remain attached to separate documents.": "। हर सामान्य फ़ील्ड के लिए एक मान चुनें। अलग-अलग दस्तावेज़ों के विशिष्ट मान उन्हीं दस्तावेज़ों से जुड़े रह सकते हैं।",
  "Enter a value before saving.": "सहेजने से पहले कोई मान दर्ज करें।",
  "Replace the saved": "पहले से सहेजे गए मान को",
  "value with the new value?": "नए मान से बदलें?",
  "saved to your verified profile.": "आपकी सत्यापित प्रोफ़ाइल में सहेजा गया।",
  "A field cannot be saved as an empty value.": "किसी फ़ील्ड को खाली मान के रूप में सहेजा नहीं जा सकता।",
  "This candidate is no longer pending. Refresh the page and try again.": "यह जानकारी अब समीक्षा के लिए लंबित नहीं है। पेज रीफ़्रेश करके दोबारा कोशिश करें।",
  "updated. Review it before approving.": "अपडेट किया गया। मंज़ूरी देने से पहले जाँचें।",
  "Candidate value dismissed.": "इस जानकारी को अस्वीकार कर दिया गया।",
  "Use a regular HTTP or HTTPS portal URL.": "सामान्य HTTP या HTTPS पोर्टल URL का उपयोग करें।",
  "Application added to your tracker.": "आवेदन आपके ट्रैकर में जोड़ दिया गया।",
  "Workspace": "वर्कस्पेस",
  "Account connected": "अकाउंट कनेक्ट है",
  "Your space": "आपकी जगह",
  "Dismiss": "बंद करें",
  "Loading your workspace…": "आपका वर्कस्पेस लोड हो रहा है…",
  "Review every value. Submit forms yourself.": "हर जानकारी जाँचें। फ़ॉर्म स्वयं सबमिट करें।",
  "Your profile is ready": "आपकी प्रोफ़ाइल तैयार है",
  "Approved details are available for supported form matching.": "मंज़ूर की गई जानकारी उपलब्ध फ़ॉर्म से मिलान करने के लिए तैयार है।",
  "View profile": "प्रोफ़ाइल देखें",
  "waiting for review": "समीक्षा की प्रतीक्षा में",
  "Check each extracted value before adding it to your profile.": "प्रोफ़ाइल में जोड़ने से पहले निकाली गई हर जानकारी जाँचें।",
  "Review details": "विवरण जाँचें",
  "Add your first document": "अपना पहला दस्तावेज़ जोड़ें",
  "Start with a PDF or a clear photo of a document you use often.": "PDF या अक्सर उपयोग किए जाने वाले दस्तावेज़ की साफ़ फ़ोटो से शुरू करें।",
  "Open document vault": "दस्तावेज़ संग्रह खोलें",
  "Add details to your profile": "अपनी प्रोफ़ाइल में जानकारी जोड़ें",
  "Enter key information once, or review values extracted from a document.": "ज़रूरी जानकारी एक बार भरें या दस्तावेज़ से निकाली गई जानकारी जाँचें।",
  "Open profile": "प्रोफ़ाइल खोलें",
  "Continue an application": "आवेदन जारी रखें",
  "You have": "आपके",
  "in progress.": "प्रगति पर हैं।",
  "View applications": "आवेदन देखें",
  "Your form companion": "आपका फ़ॉर्म सहायक",
  "Good to see you,": "आपसे मिलकर अच्छा लगा,",
  "Keep the documents and approved details you need for applications in one place.": "आवेदनों के लिए ज़रूरी दस्तावेज़ और मंज़ूर की गई जानकारी एक ही जगह रखें।",
  "Suggested next step": "अगला सुझाया गया कदम",
  "Documents stored": "सहेजे गए दस्तावेज़",
  "Reviewed profile fields": "जाँचे गए प्रोफ़ाइल फ़ील्ड",
  "Ready for form matching": "फ़ॉर्म से मिलान के लिए तैयार",
  "Extracted candidates": "निकाली गई जानकारी",
  "Active applications": "सक्रिय आवेदन",
  "tracked in total": "कुल ट्रैक किए गए",
  "Getting started": "शुरुआत करें",
  "Your setup checklist": "आपकी सेटअप सूची",
  "of 3 complete": "में से 3 पूरे",
  "Add your documents": "अपने दस्तावेज़ जोड़ें",
  "Upload a PDF or a clear image.": "PDF या साफ़ इमेज अपलोड करें।",
  "Extract information": "जानकारी निकालें",
  "Run OCR on a document you choose.": "अपने चुने हुए दस्तावेज़ पर OCR चलाएँ।",
  "Review your profile": "अपनी प्रोफ़ाइल जाँचें",
  "Approve the values you want to keep.": "जिन जानकारियों को रखना चाहते हैं, उन्हें मंज़ूर करें।",
  "Document vault": "दस्तावेज़ संग्रह",
  "Recently added": "हाल में जोड़े गए",
  "View all →": "सभी देखें →",
  "Your vault is empty": "आपका संग्रह खाली है",
  "Add your first document to begin building your profile.": "प्रोफ़ाइल बनाना शुरू करने के लिए अपना पहला दस्तावेज़ जोड़ें।",
  "Browser extension available": "ब्राउज़र एक्सटेंशन उपलब्ध है",
  "Install the Chrome extension and sign in with this same account. Approved profile facts sync for form matching.": "Chrome एक्सटेंशन इंस्टॉल करें और इसी अकाउंट से साइन इन करें। फ़ॉर्म मिलान के लिए मंज़ूर की गई प्रोफ़ाइल जानकारी सिंक होगी।",
  "View setup →": "सेटअप देखें →",
  "Add a document": "दस्तावेज़ जोड़ें",
  "PDF, JPG, PNG or WebP · Up to 10 MB. Any document category can be processed.": "PDF, JPG, PNG या WebP · अधिकतम 10 MB। किसी भी श्रेणी का दस्तावेज़ प्रोसेस किया जा सकता है।",
  "Vault category (for organisation only)": "संग्रह श्रेणी (केवल व्यवस्था के लिए)",
  "Choose file": "फ़ाइल चुनें",
  "Your private storage": "आपका निजी स्टोरेज",
  "Uploaded documents": "अपलोड किए गए दस्तावेज़",
  "⌑ Private vault": "⌑ निजी संग्रह",
  "No documents yet": "अभी कोई दस्तावेज़ नहीं है",
  "Upload any supported document. Saral Form detects its type and extracts labelled fields regardless of the selected vault category.": "कोई भी समर्थित दस्तावेज़ अपलोड करें। Saral Form चुनी गई संग्रह श्रेणी से अलग, दस्तावेज़ का प्रकार पहचानकर उसके फ़ील्ड निकालता है।",
  "Document": "दस्तावेज़",
  "Source document": "मूल दस्तावेज़",
  "Category": "श्रेणी",
  "Added": "जोड़ा गया",
  "Status": "स्थिति",
  "Actions": "कार्रवाई",
  "Detected:": "पहचाना गया:",
  "Extracted": "जानकारी निकाली गई",
  "Retry needed": "दोबारा कोशिश ज़रूरी",
  "Uploaded": "अपलोड किया गया",
  "Working…": "काम जारी है…",
  "Re-run OCR": "OCR दोबारा चलाएँ",
  "Run OCR": "OCR चलाएँ",
  "Delete document": "दस्तावेज़ हटाएँ",
  "Father's name": "पिता का नाम",
  "Mother's name": "माता का नाम",
  "Guardian's name": "अभिभावक का नाम",
  "Mobile number": "मोबाइल नंबर",
  "Residential address": "निवास का पता",
  "PIN / postal code": "PIN / डाक कोड",
  "District": "ज़िला",
  "State": "राज्य",
  "Gender": "लिंग",
  "Annual family income": "परिवार की वार्षिक आय",
  "Enter information yourself": "जानकारी स्वयं भरें",
  "Manual profile entry": "प्रोफ़ाइल में स्वयं जानकारी भरें",
  "No document upload or OCR required. Save each value to make it available to the extension.": "दस्तावेज़ अपलोड या OCR की ज़रूरत नहीं। हर जानकारी सहेजें ताकि वह एक्सटेंशन में उपलब्ध हो।",
  "You control the data": "डेटा आपके नियंत्रण में है",
  "Update": "अपडेट करें",
  "Save": "सहेजें",
  "Manually entered values are marked as user-verified after you save them. Check spelling and numbers carefully. You can update them here at any time.": "स्वयं भरी गई जानकारी सहेजने के बाद उपयोगकर्ता-सत्यापित मानी जाती है। वर्तनी और नंबर ध्यान से जाँचें। आप इन्हें कभी भी अपडेट कर सकते हैं।",
  "Your information profile": "आपकी जानकारी प्रोफ़ाइल",
  "Only values you approve are marked as reviewed and made available for future form matching.": "केवल आपकी मंज़ूर की गई जानकारी को जाँचा हुआ माना जाएगा और भविष्य में फ़ॉर्म मिलान के लिए उपलब्ध किया जाएगा।",
  "reviewed": "जाँचा गया",
  "Saved information": "सहेजी गई जानकारी",
  "Reviewed profile": "जाँची गई प्रोफ़ाइल",
  "fields": "फ़ील्ड",
  "Nothing verified yet": "अभी कुछ सत्यापित नहीं है",
  "Enter information manually above or run OCR on a document and approve the values you want to save here.": "ऊपर जानकारी स्वयं भरें या किसी दस्तावेज़ पर OCR चलाकर वे मान मंज़ूर करें जिन्हें यहाँ सहेजना चाहते हैं।",
  "Manually added": "स्वयं जोड़ा गया",
  "✓ Reviewed": "✓ जाँचा गया",
  "Source:": "स्रोत:",
  "Stored with source documents": "मूल दस्तावेज़ों के साथ सहेजा गया",
  "Document-specific information": "दस्तावेज़-विशिष्ट जानकारी",
  "Identifiers, certificate details and academic records stay linked to the document they came from.": "पहचान संख्या, प्रमाणपत्र विवरण और शैक्षणिक रिकॉर्ड उसी मूल दस्तावेज़ से जुड़े रहते हैं।",
  "No document-specific values approved yet": "अभी कोई दस्तावेज़-विशिष्ट जानकारी मंज़ूर नहीं है",
  "Approve a certificate number, identity number or other document-only field to keep it here.": "प्रमाणपत्र संख्या, पहचान संख्या या दस्तावेज़ से जुड़ा कोई अन्य फ़ील्ड मंज़ूर करके यहाँ रखें।",
  "✓ Approved · retained in this document's record": "✓ मंज़ूर · इस दस्तावेज़ के रिकॉर्ड में सुरक्षित",
  "Approve reusable personal details into your general profile. Document identifiers and certificate-specific values remain attached to their source document.": "दोबारा उपयोग की जाने वाली निजी जानकारी अपनी सामान्य प्रोफ़ाइल में मंज़ूर करें। दस्तावेज़ पहचान और प्रमाणपत्र से जुड़े मान मूल दस्तावेज़ के साथ ही रहेंगे।",
  "pending": "लंबित",
  "You're all caught up": "सभी जानकारी जाँच ली गई है",
  "New OCR results will appear here for your review.": "नए OCR परिणाम जाँच के लिए यहाँ दिखाई देंगे।",
  "Select all detected fields": "पहचाने गए सभी फ़ील्ड चुनें",
  "Selected": "चयनित",
  "Select document": "दस्तावेज़ चुनें",
  "Select": "चुनें",
  "Edit": "बदलें",
  "Extraction confidence": "जानकारी पहचानने का भरोसा",
  "Confidence unavailable": "विश्वास स्तर उपलब्ध नहीं",
  "Save edit": "बदलाव सहेजें",
  "Cancel": "रद्द करें",
  "Use this value": "यह मान उपयोग करें",
  "You can edit OCR candidates before approving them. OCR confidence is a technical estimate, not proof that a value is correct. Always compare it with the original document.": "मंज़ूरी देने से पहले OCR से निकली जानकारी बदल सकते हैं। OCR का विश्वास स्तर केवल तकनीकी अनुमान है, सही होने का प्रमाण नहीं। हमेशा मूल दस्तावेज़ से मिलान करें।",
  "New tracker": "नया ट्रैकर",
  "Add an application": "आवेदन जोड़ें",
  "Keep a simple record of forms you're preparing.": "जिन फ़ॉर्म की तैयारी कर रहे हैं, उनका सरल रिकॉर्ड रखें।",
  "Application name": "आवेदन का नाम",
  "Official portal URL": "आधिकारिक पोर्टल URL",
  "(optional)": "(वैकल्पिक)",
  "Add to tracker": "ट्रैकर में जोड़ें",
  "Your tracker": "आपका ट्रैकर",
  "No applications tracked": "अभी कोई आवेदन ट्रैक नहीं किया गया",
  "Add a scholarship, certificate or other application to keep its progress in one place.": "छात्रवृत्ति, प्रमाणपत्र या अन्य आवेदन जोड़ें ताकि उसकी प्रगति एक जगह रहे।",
  "No portal link added": "पोर्टल लिंक नहीं जोड़ा गया",
  "Open portal ↗": "पोर्टल खोलें ↗",
  "Not started": "शुरू नहीं हुआ",
  "In progress": "प्रगति पर",
  "Ready to review": "जाँच के लिए तैयार",
  "Submitted": "सबमिट किया गया",
  "This tracker is a personal note. Saral Form does not verify application status with government portals.": "यह ट्रैकर आपका निजी रिकॉर्ड है। Saral Form सरकारी पोर्टल से आवेदन की स्थिति सत्यापित नहीं करता।",
  "Choose a JPG, PNG or WebP photo. HEIC conversion is not enabled in this prototype.": "JPG, PNG या WebP फ़ोटो चुनें। इस प्रोटोटाइप में HEIC कन्वर्ज़न उपलब्ध नहीं है।",
  "The photo must be 10 MB or smaller.": "फ़ोटो 10 MB या उससे छोटी होनी चाहिए।",
  "Take a photo or choose an image first.": "पहले फ़ोटो लें या इमेज चुनें।",
  "Confirm the AI photo-processing notice before scanning.": "स्कैन करने से पहले AI फ़ोटो प्रोसेसिंग की सूचना स्वीकार करें।",
  "Your information profile has no approved values yet. Review and approve profile facts first.": "आपकी जानकारी प्रोफ़ाइल में अभी कोई मंज़ूर मान नहीं है। पहले जानकारी जाँचें और मंज़ूर करें।",
  "Reading printed labels and locating safe writing areas…": "छपे हुए लेबल पढ़े जा रहे हैं और लिखने के सुरक्षित स्थान खोजे जा रहे हैं…",
  "Saral Form could not analyse this paper form.": "Saral Form इस कागज़ी फ़ॉर्म का विश्लेषण नहीं कर सका।",
  "The backend did not return the oriented source image.": "बैकएंड से सही दिशा वाली मूल इमेज नहीं मिली।",
  "No safe writable areas were found. Try a sharper, straight-on photo or fill the paper form manually.": "लिखने के सुरक्षित स्थान नहीं मिले। अधिक साफ़ और सीधी फ़ोटो लें या फ़ॉर्म स्वयं भरें।",
  "Form labels were analysed. Review every suggested value and its placement before approving a copy.": "फ़ॉर्म के लेबल का विश्लेषण हो गया। कॉपी मंज़ूर करने से पहले हर सुझाए गए मान और उसकी जगह जाँचें।",
  "The original scanned image is no longer available. Scan the form again.": "मूल स्कैन की गई इमेज अब उपलब्ध नहीं है। फ़ॉर्म दोबारा स्कैन करें।",
  "Keep at least one reviewed field in the final copy.": "अंतिम कॉपी में कम से कम एक जाँचा हुआ फ़ील्ड रखें।",
  "You approved the reviewed values. A new downloadable copy has been prepared; nothing was submitted.": "आपने जाँची गई जानकारी मंज़ूर कर दी है। डाउनलोड करने योग्य नई कॉपी तैयार है; कुछ भी सबमिट नहीं किया गया।",
  "Paper form assistant": "कागज़ी फ़ॉर्म सहायक",
  "Photograph a paper form. Review it. Download a filled copy.": "कागज़ी फ़ॉर्म की फ़ोटो लें। जाँचें। भरी हुई कॉपी डाउनलोड करें।",
  "Saral Form reads printed labels, matches only your approved profile values and suggests safe writing areas. You edit and approve every placement before the final copy is created.": "Saral Form छपे हुए लेबल पढ़ता है, केवल आपकी मंज़ूर प्रोफ़ाइल जानकारी से मिलान करता है और लिखने के सुरक्षित स्थान सुझाता है। अंतिम कॉपी बनने से पहले आप हर स्थान बदलकर मंज़ूर करते हैं।",
  "reviewed profile value(s) available": "जाँचे गए प्रोफ़ाइल मान उपलब्ध",
  "Paper form filling steps": "कागज़ी फ़ॉर्म भरने के चरण",
  "Add photo": "फ़ोटो जोड़ें",
  "Analyse": "विश्लेषण करें",
  "Review values": "मान जाँचें",
  "Final check": "अंतिम जाँच",
  "Download": "डाउनलोड करें",
  "Step 1 · Add your form": "चरण 1 · अपना फ़ॉर्म जोड़ें",
  "Take a photo or choose an image": "फ़ोटो लें या इमेज चुनें",
  "Open camera": "कैमरा खोलें",
  "Choose from gallery": "गैलरी से चुनें",
  "Keep the entire page inside the frame. Photograph it from directly above, in good light, without shadows or blur.": "पूरा पेज फ़्रेम के भीतर रखें। अच्छी रोशनी में, सीधे ऊपर से और बिना परछाईं या धुंधलेपन के फ़ोटो लें।",
  "Original photo": "मूल फ़ोटो",
  "Original paper form photo": "कागज़ी फ़ॉर्म की मूल फ़ोटो",
  "Scanning and locating writing areas…": "स्कैन हो रहा है और लिखने के स्थान खोजे जा रहे हैं…",
  "Scan this paper form →": "यह कागज़ी फ़ॉर्म स्कैन करें →",
  "Step 3 · Review before filling": "चरण 3 · भरने से पहले जाँचें",
  "Check each suggested value": "हर सुझाया गया मान जाँचें",
  "Uncheck a value to leave that area blank. Editing a value here changes only this image, not your saved profile.": "किसी स्थान को खाली रखने के लिए उसका चयन हटाएँ। यहाँ मान बदलने से केवल इस इमेज में बदलाव होगा, आपकी सहेजी गई प्रोफ़ाइल में नहीं।",
  "Updating…": "अपडेट हो रहा है…",
  "Your edits appear here": "आपके बदलाव यहाँ दिखेंगे",
  "Live filled preview": "भरी हुई कॉपी का लाइव प्रीव्यू",
  "Live preview of reviewed paper form placements": "कागज़ी फ़ॉर्म में जाँचे गए मानों की लाइव झलक",
  "Preparing the preview…": "प्रीव्यू तैयार हो रहा है…",
  "Include": "शामिल करें",
  "in the filled copy": "भरी हुई कॉपी में",
  "Value to place": "भरने के लिए मान",
  "Restore profile value": "प्रोफ़ाइल का मान वापस लाएँ",
  "← Change photo": "← फ़ोटो बदलें",
  "Continue to final check →": "अंतिम जाँच पर जाएँ →",
  "Check the placement preview as well as the values. Gemini confidence is an estimate, not a guarantee that text is positioned correctly.": "मानों के साथ उनकी जगह का प्रीव्यू भी जाँचें। Gemini का विश्वास स्तर केवल अनुमान है, यह गारंटी नहीं कि टेक्स्ट सही जगह पर है।",
  "STOP": "रुकें",
  "Step 4 · Human approval required": "चरण 4 · आपकी मंज़ूरी ज़रूरी है",
  "Check everything before creating the final copy.": "अंतिम कॉपी बनाने से पहले सब कुछ जाँचें।",
  "Final review before approval": "मंज़ूरी से पहले अंतिम जाँच",
  "← Go back and fix": "← वापस जाकर सुधारें",
  "Preparing approved copy…": "मंज़ूर की गई कॉपी तैयार हो रही है…",
  "I checked this. Create my copy →": "मैंने जाँच लिया। मेरी कॉपी बनाएँ →",
  "Step 5 · Ready to download": "चरण 5 · डाउनलोड के लिए तैयार",
  "Your approved filled copy": "आपकी मंज़ूर की गई भरी हुई कॉपी",
  "Approved filled paper form copy": "मंज़ूर की गई भरी हुई कागज़ी फ़ॉर्म कॉपी",
  "Download filled image ↓": "भरी हुई इमेज डाउनलोड करें ↓",
  "New copy created locally in your browser. Original photo remains unchanged.": "आपके ब्राउज़र में नई कॉपी बनाई गई है। मूल फ़ोटो में कोई बदलाव नहीं हुआ।",
  "Review the downloaded image before printing or signing. Nothing was submitted or sent to the form issuer.": "प्रिंट या हस्ताक्षर करने से पहले डाउनलोड की गई इमेज जाँचें। कुछ भी सबमिट नहीं हुआ और फ़ॉर्म जारी करने वाले को नहीं भेजा गया।",
  "Start another paper form": "दूसरा कागज़ी फ़ॉर्म शुरू करें",
  "Important:": "महत्वपूर्ण:",
  "The final copy is an image, not an official digitally submitted form. Text placement can be imperfect. Saral Form does not add signatures, certify documents, pay fees or submit applications. The human approval step is mandatory.": "अंतिम कॉपी एक इमेज है, आधिकारिक रूप से डिजिटल सबमिट किया गया फ़ॉर्म नहीं। टेक्स्ट की जगह पूरी तरह सही न हो सकती है। Saral Form हस्ताक्षर नहीं जोड़ता, दस्तावेज़ प्रमाणित नहीं करता, शुल्क नहीं भरता और आवेदन सबमिट नहीं करता। आपकी मंज़ूरी अनिवार्य है।",
  "Your data, your call": "आपका डेटा, आपका नियंत्रण",
  "Privacy should be part of the product.": "गोपनीयता उत्पाद का हिस्सा होनी चाहिए।",
  "Saral Form is designed to process only what you choose and keep you in control of every suggested value.": "Saral Form केवल आपकी चुनी हुई जानकारी प्रोसेस करने और हर सुझाए गए मान पर आपका नियंत्रण बनाए रखने के लिए बनाया गया है।",
  "Private document storage": "निजी दस्तावेज़ स्टोरेज",
  "Files are stored in a non-public Supabase Storage bucket. Row-level security policies restrict access to the authenticated owner.": "फ़ाइलें निजी Supabase Storage bucket में रखी जाती हैं। Row-level security नीतियाँ केवल प्रमाणित मालिक को पहुँच देती हैं।",
  "Configured in database migration": "डेटाबेस माइग्रेशन में कॉन्फ़िगर किया गया",
  "On-demand OCR": "ज़रूरत पर OCR",
  "Uploading a document does not automatically run OCR. When you choose Run OCR, that file is sent over HTTPS to our hosted OCR processor for in-memory processing. Candidate values need your approval.": "दस्तावेज़ अपलोड करने से OCR अपने-आप नहीं चलता। Run OCR चुनने पर फ़ाइल HTTPS के ज़रिए हमारे होस्टेड OCR प्रोसेसर को अस्थायी प्रोसेसिंग के लिए भेजी जाती है। निकाली गई जानकारी के लिए आपकी मंज़ूरी ज़रूरी है।",
  "User initiated": "उपयोगकर्ता द्वारा शुरू किया गया",
  "Limited profile data": "सीमित प्रोफ़ाइल डेटा",
  "The extension and paper-form scanner use only approved profile facts relevant to the current task, not the entire document vault.": "एक्सटेंशन और कागज़ी फ़ॉर्म स्कैनर केवल मौजूदा काम से जुड़ी मंज़ूर प्रोफ़ाइल जानकारी उपयोग करते हैं, पूरा दस्तावेज़ संग्रह नहीं।",
  "Reviewed profile facts only": "केवल जाँची गई प्रोफ़ाइल जानकारी",
  "Paper-form photo scan": "कागज़ी फ़ॉर्म फ़ोटो स्कैन",
  "The selected photo is sent to the Saral Form backend and Google Gemini after your consent. The processing route does not save the photo to your document vault.": "आपकी सहमति के बाद चुनी गई फ़ोटो Saral Form बैकएंड और Google Gemini को भेजी जाती है। प्रोसेसिंग के दौरान फ़ोटो आपके दस्तावेज़ संग्रह में सहेजी नहीं जाती।",
  "User initiated · in-memory API processing": "उपयोगकर्ता द्वारा शुरू · अस्थायी API प्रोसेसिंग",
  "Delete your data": "अपना डेटा हटाएँ",
  "Remove uploaded files, extracted candidates, reviewed profile values and application tracker entries while keeping your login account.": "लॉगिन अकाउंट रखते हुए अपलोड की गई फ़ाइलें, निकाली गई जानकारी, जाँची गई प्रोफ़ाइल और आवेदन ट्रैकर की प्रविष्टियाँ हटाएँ।",
  "Account data": "अकाउंट डेटा",
  "Clearing…": "हटाया जा रहा है…",
  "Delete my Saral Form data": "मेरा Saral Form डेटा हटाएँ",
  "Clear your Saral Form content from the active database and private storage. This does not delete your Supabase login account or copies retained in backups according to your provider's retention settings.": "अपने Saral Form का डेटा सक्रिय डेटाबेस और निजी स्टोरेज से हटाएँ। इससे आपका Supabase लॉगिन अकाउंट या प्रदाता की बैकअप नीति के तहत रखी गई कॉपियाँ नहीं हटेंगी।",
  "Prototype warning:": "प्रोटोटाइप चेतावनी:",
  "this is an MVP foundation, not an independently audited production vault. Use synthetic documents in demos until the hosted project, access policies, backup retention and security controls have been reviewed.": "यह MVP का आधार है, स्वतंत्र रूप से ऑडिट किया गया प्रोडक्शन दस्तावेज़ संग्रह नहीं। होस्टेड प्रोजेक्ट, एक्सेस नीतियों, बैकअप और सुरक्षा नियंत्रणों की समीक्षा होने तक डेमो में केवल नकली दस्तावेज़ उपयोग करें।",
  "Processed": "प्रोसेस किया गया",
  "Retry": "दोबारा कोशिश करें",
  "Stored": "सहेजा गया",
  "Saral Form for Chrome": "Chrome के लिए Saral Form",
  "Take your reviewed profile to the form.": "अपनी जाँची हुई प्रोफ़ाइल फ़ॉर्म तक ले जाएँ।",
  "Saral Form can read the fields on the active page, match them against your approved information profile and let you review each suggested value before filling.": "Saral Form खुले पेज के फ़ील्ड पढ़ सकता है, उनका आपकी मंज़ूर जानकारी से मिलान कर सकता है और भरने से पहले हर सुझाए गए मान की समीक्षा करने देता है।",
  "Download Chrome extension": "Chrome एक्सटेंशन डाउनलोड करें",
  "View release notes ↗": "रिलीज़ नोट देखें ↗",
  "One-time setup": "एक बार का सेटअप",
  "Install the development build": "डेवलपमेंट बिल्ड इंस्टॉल करें",
  "Download and extract": "डाउनलोड करें और निकालें",
  "Download the ZIP above and extract it to a folder on your computer.": "ऊपर दी गई ZIP डाउनलोड करें और उसे अपने कंप्यूटर के फ़ोल्डर में निकालें।",
  "Open Chrome extensions": "Chrome एक्सटेंशन खोलें",
  "in the browser address bar.": "ब्राउज़र के एड्रेस बार में।",
  "Enable Developer mode": "Developer mode चालू करें",
  "Turn on Developer mode using the switch near the top-right corner.": "ऊपर दाईं ओर दिए गए स्विच से Developer mode चालू करें।",
  "Load the extension": "एक्सटेंशन लोड करें",
  "Click Load unpacked and select the extracted folder that contains": "Load unpacked पर क्लिक करें और वह निकाला गया फ़ोल्डर चुनें जिसमें यह फ़ाइल है:",
  "Open Saral Form": "Saral Form खोलें",
  "Pin the extension if desired, then open its side panel from the Chrome toolbar.": "चाहें तो एक्सटेंशन को पिन करें, फिर Chrome टूलबार से उसका साइड पैनल खोलें।",
  "Your Saral Form account": "आपका Saral Form अकाउंट",
  "Connect using the same account": "उसी अकाउंट से कनेक्ट करें",
  "Sign in inside the extension with the same email address and password you use on this website. The extension keeps its own protected browser-extension session; it does not copy credentials from the website.": "एक्सटेंशन में उसी ईमेल और पासवर्ड से साइन इन करें जिसका उपयोग इस वेबसाइट पर करते हैं। एक्सटेंशन अपना सुरक्षित ब्राउज़र सत्र रखता है; वेबसाइट से लॉगिन जानकारी कॉपी नहीं करता।",
  "Website account": "वेबसाइट अकाउंट",
  "When a form is scanned, the extension requests only verified profile fields that match detected form labels. Database row-level security determines which user's values can be returned.": "फ़ॉर्म स्कैन होने पर एक्सटेंशन केवल उन सत्यापित प्रोफ़ाइल फ़ील्ड का अनुरोध करता है जो पहचाने गए लेबल से मेल खाते हैं। डेटाबेस की row-level security तय करती है कि किस उपयोगकर्ता की जानकारी मिल सकती है।",
  "Distribution note:": "वितरण संबंधी सूचना:",
  "This is a development ZIP for manual installation. It is not yet published in the Chrome Web Store, so Chrome requires Developer mode and Load unpacked. The extension only fills fields after you approve them; it never submits the form.": "यह मैन्युअल इंस्टॉलेशन के लिए डेवलपमेंट ZIP है। यह अभी Chrome Web Store पर प्रकाशित नहीं है, इसलिए Chrome में Developer mode और Load unpacked ज़रूरी हैं। एक्सटेंशन केवल आपकी मंज़ूरी के बाद फ़ील्ड भरता है; फ़ॉर्म कभी सबमिट नहीं करता।",
  "Sign out": "साइन आउट",
  "Main navigation": "मुख्य नेविगेशन",
  "YOUR WORKSPACE": "आपका वर्कस्पेस",
  "Navigation object": "नेविगेशन ऑब्जेक्ट",
  "3D preview unavailable": "3D प्रीव्यू उपलब्ध नहीं",
  "e.g. Post-matric scholarship": "उदाहरण: पोस्ट-मैट्रिक छात्रवृत्ति",
  "details waiting for review": "विवरण समीक्षा की प्रतीक्षा में"
};

const reverseHindi = new Map<string, string>();
for (const [source, translated] of Object.entries(hindiTranslations)) {
  if (!reverseHindi.has(translated)) reverseHindi.set(translated, source);
}

const ignoredSelector = "script,style,noscript,code,pre,[data-no-translate]";
const translatableAttributes = ["placeholder", "title", "aria-label", "aria-description", "alt"];

function localizePhrase(value: string, locale: Locale): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return value;

  const source = locale === "hi" ? (reverseHindi.get(trimmed) || trimmed) : (reverseHindi.get(trimmed) || trimmed);
  let translated = locale === "hi" ? (hindiTranslations[source] || source) : source;

  if (locale === "hi" && translated === source) {
    const uploaded = source.match(/^(.+) uploaded\. Saral Form will now ask permission to extract its labelled fields\.$/);
    if (uploaded) translated = uploaded[1] + " अपलोड हो गया। Saral Form अब इसके फ़ील्ड निकालने की अनुमति माँगेगा।";
    const greeting = source.match(/^Good to see you, (.+)\.$/);
    if (greeting) translated = "आपसे मिलकर अच्छा लगा, " + greeting[1] + "।";
    const waiting = source.match(/^(\d+) details waiting for review$/);
    if (waiting) translated = waiting[1] + " विवरण समीक्षा की प्रतीक्षा में";
    const count = source.match(/^(\d+) documents stored$/);
    if (count) translated = count[1] + " दस्तावेज़ सहेजे गए";
    const scanError = source.match(/^OCR service returned HTTP (.+)\. Check the backend route and Render logs\.$/);
    if (scanError) translated = "OCR सेवा ने HTTP " + scanError[1] + " लौटाया। बैकएंड रूट और Render लॉग जाँचें।";
    const detected = source.match(/^(AI|OCR) detected (\d+) new field\(s\) in this document\. Select the values you want to save to your profile\.$/);
    if (detected) translated = (detected[1] === "AI" ? "AI ने" : "OCR ने") + " इस दस्तावेज़ में " + detected[2] + " नए फ़ील्ड पहचाने। प्रोफ़ाइल में सहेजने वाले मान चुनें।";
  }

  if (locale === "en") {
    const uploaded = value.trim().match(/^(.+) अपलोड हो गया। Saral Form अब इसके फ़ील्ड निकालने की अनुमति माँगेगा।$/);
    if (uploaded) translated = uploaded[1] + " uploaded. Saral Form will now ask permission to extract its labelled fields.";
    const greeting = value.trim().match(/^आपसे मिलकर अच्छा लगा, (.+)।$/);
    if (greeting) translated = "Good to see you, " + greeting[1] + ".";
    const waiting = value.trim().match(/^(\d+) विवरण समीक्षा की प्रतीक्षा में$/);
    if (waiting) translated = waiting[1] + " details waiting for review";
    const count = value.trim().match(/^(\d+) दस्तावेज़ सहेजे गए$/);
    if (count) translated = count[1] + " documents stored";
  }
  return value.replace(value.trim(), translated);
}

function localizeTree(root: HTMLElement, locale: Locale) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest(ignoredSelector)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let current: Node | null;
  while ((current = walker.nextNode())) {
    const original = current.nodeValue || "";
    const localized = localizePhrase(original, locale);
    if (localized !== original) current.nodeValue = localized;
  }

  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    if (element.closest("[data-no-translate]")) return;
    for (const attribute of translatableAttributes) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const localized = localizePhrase(value, locale);
      if (localized !== value) element.setAttribute(attribute, localized);
    }
  });
}

function readSavedLocale(): Locale {
  try {
    return window.localStorage.getItem("saral-form-locale") === "hi" ? "hi" : "en";
  } catch {
    return "en";
  }
}

export default function AppLocalization({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [locale, setLocale] = useState<Locale>(readSavedLocale);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const apply = () => localizeTree(root, locale);
    apply();

    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        if (root.isConnected) apply();
      });
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: translatableAttributes
    });

    document.documentElement.lang = locale;
    document.title = locale === "hi" ? "Saral Form · कागज़ी काम, अब आसान" : "Saral Form · Your paperwork, made clearer";
    return () => observer.disconnect();
  }, [locale]);

  function chooseLanguage(nextLocale: Locale) {
    setLocale(nextLocale);
    setMenuOpen(false);
    try {
      window.localStorage.setItem("saral-form-locale", nextLocale);
    } catch {
      // The language still changes for this session when storage is unavailable.
    }
  }

  return (
    <div className="app-localization-root" ref={rootRef}>
      {children}
      <div
        className="app-language-tool"
        data-no-translate
        onKeyDown={(event) => {
          if (event.key === "Escape") setMenuOpen(false);
        }}
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (!next || !event.currentTarget.contains(next as Node)) setMenuOpen(false);
        }}
      >
        <button
          className="app-language-trigger"
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={locale === "hi" ? "ऐप की भाषा बदलें" : "Change app language"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="app-language-globe" aria-hidden="true">文</span>
          <span className="app-language-current">{locale === "hi" ? "हिन्दी" : "English"}</span>
          <span className="app-language-chevron" aria-hidden="true">⌄</span>
        </button>
        {menuOpen && (
          <div className="app-language-menu" role="menu" aria-label="App language">
            <p>{locale === "hi" ? "ऐप की भाषा" : "Display language"}</p>
            <button type="button" role="menuitemradio" aria-checked={locale === "en"} onClick={() => chooseLanguage("en")}>
              <span>English</span><span>{locale === "en" ? "✓" : ""}</span>
            </button>
            <button type="button" role="menuitemradio" aria-checked={locale === "hi"} onClick={() => chooseLanguage("hi")}>
              <span>हिन्दी</span><span>{locale === "hi" ? "✓" : ""}</span>
            </button>
            <small>{locale === "hi" ? "केवल ऐप के लेबल और निर्देश अनुवादित होते हैं। आपके दस्तावेज़ और निजी जानकारी नहीं बदलते।" : "Only app labels and guidance are translated. Your documents and personal details stay unchanged."}</small>
          </div>
        )}
      </div>
    </div>
  );
}
