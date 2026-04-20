with open(r'c:\MFO-CRM\apps\web\app\(dashboard)\communications\page.tsx', 'r', encoding='utf-8') as f:
    original = f.read()

with open('email_replacement.txt', 'r', encoding='utf-8') as f:
    replacement = f.read()

start_index = original.find("{activeTab === 'email' && (")
if start_index != -1:
    bracket_count = 0
    end_index = -1
    for i in range(start_index, len(original)):
        if original[i] == '{':
            bracket_count += 1
        elif original[i] == '}':
            bracket_count -= 1
            if bracket_count == 0:
                end_index = i
                break
                
    if end_index != -1:
        new_text = original[:start_index] + replacement + original[end_index+1:]
        with open(r'c:\MFO-CRM\apps\web\app\(dashboard)\communications\page.tsx', 'w', encoding='utf-8') as f:
            f.write(new_text)
        print("SUCCESSFULLY REPLACED EMAIL BLOCK")
    else:
        print("FAILED TO FIND END BRACKET")
else:
    print("FAILED TO FIND START STRING")
