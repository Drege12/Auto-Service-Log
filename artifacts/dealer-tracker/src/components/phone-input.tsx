import { useState, useEffect } from "react";

interface Country {
  code: string;
  name: string;
  dial: string;
  flag: string;
  pattern: string;
}

const COUNTRIES: Country[] = [
  { code: "US", name: "United States",   dial: "+1",   flag: "🇺🇸", pattern: "(###) ###-####"   },
  { code: "CA", name: "Canada",          dial: "+1",   flag: "🇨🇦", pattern: "(###) ###-####"   },
  { code: "MX", name: "Mexico",          dial: "+52",  flag: "🇲🇽", pattern: "## #### ####"     },
  { code: "GB", name: "United Kingdom",  dial: "+44",  flag: "🇬🇧", pattern: "#### ######"      },
  { code: "AU", name: "Australia",       dial: "+61",  flag: "🇦🇺", pattern: "#### ### ###"     },
  { code: "NZ", name: "New Zealand",     dial: "+64",  flag: "🇳🇿", pattern: "### ### ####"     },
  { code: "IE", name: "Ireland",         dial: "+353", flag: "🇮🇪", pattern: "## ### ####"      },
  { code: "DE", name: "Germany",         dial: "+49",  flag: "🇩🇪", pattern: "### ## #####"     },
  { code: "FR", name: "France",          dial: "+33",  flag: "🇫🇷", pattern: "# ## ## ## ##"    },
  { code: "ES", name: "Spain",           dial: "+34",  flag: "🇪🇸", pattern: "### ### ###"      },
  { code: "IT", name: "Italy",           dial: "+39",  flag: "🇮🇹", pattern: "### ### ####"     },
  { code: "PT", name: "Portugal",        dial: "+351", flag: "🇵🇹", pattern: "### ### ###"      },
  { code: "NL", name: "Netherlands",     dial: "+31",  flag: "🇳🇱", pattern: "## ### ####"      },
  { code: "BE", name: "Belgium",         dial: "+32",  flag: "🇧🇪", pattern: "### ## ## ##"     },
  { code: "CH", name: "Switzerland",     dial: "+41",  flag: "🇨🇭", pattern: "## ### ## ##"     },
  { code: "SE", name: "Sweden",          dial: "+46",  flag: "🇸🇪", pattern: "##-### ## ##"     },
  { code: "NO", name: "Norway",          dial: "+47",  flag: "🇳🇴", pattern: "### ## ###"       },
  { code: "DK", name: "Denmark",         dial: "+45",  flag: "🇩🇰", pattern: "## ## ## ##"      },
  { code: "FI", name: "Finland",         dial: "+358", flag: "🇫🇮", pattern: "## ### ####"      },
  { code: "PL", name: "Poland",          dial: "+48",  flag: "🇵🇱", pattern: "### ### ###"      },
  { code: "BR", name: "Brazil",          dial: "+55",  flag: "🇧🇷", pattern: "(##) #####-####"  },
  { code: "AR", name: "Argentina",       dial: "+54",  flag: "🇦🇷", pattern: "## ####-####"     },
  { code: "CO", name: "Colombia",        dial: "+57",  flag: "🇨🇴", pattern: "### ### ####"     },
  { code: "CL", name: "Chile",           dial: "+56",  flag: "🇨🇱", pattern: "# #### ####"      },
  { code: "IN", name: "India",           dial: "+91",  flag: "🇮🇳", pattern: "##### #####"      },
  { code: "PH", name: "Philippines",     dial: "+63",  flag: "🇵🇭", pattern: "### ### ####"     },
  { code: "JP", name: "Japan",           dial: "+81",  flag: "🇯🇵", pattern: "##-####-####"     },
  { code: "KR", name: "South Korea",     dial: "+82",  flag: "🇰🇷", pattern: "##-####-####"     },
  { code: "CN", name: "China",           dial: "+86",  flag: "🇨🇳", pattern: "### #### ####"    },
  { code: "ZA", name: "South Africa",    dial: "+27",  flag: "🇿🇦", pattern: "## ### ####"      },
  { code: "NG", name: "Nigeria",         dial: "+234", flag: "🇳🇬", pattern: "### ### ####"     },
];

const DEFAULT_COUNTRY = COUNTRIES[0];

function maxDigits(pattern: string): number {
  return pattern.split("").filter(c => c === "#").length;
}

function applyPattern(digits: string, pattern: string): string {
  const max = maxDigits(pattern);
  const d = digits.slice(0, max);
  let result = "";
  let di = 0;
  for (const ch of pattern) {
    if (di >= d.length) break;
    if (ch === "#") {
      result += d[di++];
    } else {
      result += ch;
    }
  }
  return result;
}

function stripDigits(s: string): string {
  return s.replace(/\D/g, "");
}

function detectCountry(stored: string): { country: Country; localDigits: string } {
  if (!stored) return { country: DEFAULT_COUNTRY, localDigits: "" };
  for (const c of [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length)) {
    if (stored.startsWith(c.dial + " ") || stored.startsWith(c.dial)) {
      const rest = stored.slice(c.dial.length).replace(/^\s+/, "");
      return { country: c, localDigits: stripDigits(rest) };
    }
  }
  return { country: DEFAULT_COUNTRY, localDigits: stripDigits(stored) };
}

interface PhoneInputProps {
  value: string;
  onChange: (formatted: string) => void;
  className?: string;
}

export function PhoneInput({ value, onChange, className = "" }: PhoneInputProps) {
  const detected = detectCountry(value);
  const [country, setCountry] = useState<Country>(detected.country);
  const [localDigits, setLocalDigits] = useState(detected.localDigits);

  useEffect(() => {
    const d = detectCountry(value);
    setCountry(d.country);
    setLocalDigits(d.localDigits);
  }, []);

  const formatted = applyPattern(localDigits, country.pattern);
  const fullValue = localDigits ? `${country.dial} ${formatted}` : "";

  const handleCountryChange = (code: string) => {
    const c = COUNTRIES.find(x => x.code === code) ?? DEFAULT_COUNTRY;
    setCountry(c);
    const trimmed = localDigits.slice(0, maxDigits(c.pattern));
    setLocalDigits(trimmed);
    const fmt = applyPattern(trimmed, c.pattern);
    onChange(trimmed ? `${c.dial} ${fmt}` : "");
  };

  const handleInput = (raw: string) => {
    const digits = stripDigits(raw).slice(0, maxDigits(country.pattern));
    setLocalDigits(digits);
    const fmt = applyPattern(digits, country.pattern);
    onChange(digits ? `${country.dial} ${fmt}` : "");
  };

  return (
    <div className={`flex items-stretch border-2 border-black rounded-md overflow-hidden bg-white focus-within:ring-2 focus-within:ring-black ${className}`}>
      <select
        value={country.code}
        onChange={e => handleCountryChange(e.target.value)}
        className="shrink-0 bg-white text-black border-0 border-r-2 border-black px-2 text-base font-medium focus:outline-none cursor-pointer"
        style={{ minWidth: "5rem" }}
      >
        {COUNTRIES.map(c => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.dial}
          </option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="tel"
        value={formatted}
        onChange={e => handleInput(e.target.value)}
        placeholder={country.pattern.replace(/#/g, "0")}
        className="flex-1 bg-white text-black border-0 px-3 py-2 text-lg focus:outline-none min-w-0"
      />
    </div>
  );
}
